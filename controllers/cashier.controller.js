const db = require('../database/database');
const QRCode = require('qrcode');
const { randomUUID } = require('crypto');
const tunnel = require('../utils/tunnel');
const emit = require('../utils/events');
const { check, id, money, today } = require('../utils/validation');
const { openSession } = require('../utils/sessions');
const { totals, itemsFor } = require('../utils/billing');

exports.getTables = async function (req, res) {
  const tables =
    await db.query(`SELECT t.*, s.session_id, s.qr_token, s.guest_count, s.started_at, s.buffet_price
        FROM DiningTable t LEFT JOIN DiningSession s ON t.table_id = s.table_id AND s.session_status = 'ACTIVE'
        ORDER BY CAST(t.table_no AS INTEGER)`);
  const waitingQueues = await db.query(
    `SELECT * FROM QueueTicket WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
        ORDER BY CAST(SUBSTR(queue_no, 2) AS INTEGER)`,
    [today()]
  );
  let urlError = '';
  try {
    tunnel.getPublicUrl(req);
  } catch (err) {
    urlError = err.message;
  }
  res.render('cashier/tables', {
    tables,
    waitingQueues,
    availableCount: tables.filter((t) => t.table_status === 'AVAILABLE').length,
    occupiedCount: tables.filter((t) => t.table_status === 'OCCUPIED').length,
    urlError,
    queueDate: today(),
    title: 'จัดการโต๊ะและคิว'
  });
};

async function qrData(req, session) {
  const customerUrl = tunnel.getPublicUrl(req) + '/qr/' + session.qr_token;
  return {
    ...session,
    customer_url: customerUrl,
    buffet_totals: totals(session, []),
    qr_image: await QRCode.toDataURL(customerUrl, { width: 300, margin: 2 })
  };
}

exports.openTable = async function (req, res) {
  // ตรวจ URL ก่อนเขียนข้อมูล เพื่อไม่เปิดโต๊ะแล้วสร้าง QR ไม่ได้
  tunnel.getPublicUrl(req);
  const session = await openSession(req.body, req.staff.employee_id);
  emit(req, 'table-status-changed', session);
  if (req.body.queue_ticket_id) {
    emit(req, 'queue-updated');
  }
  res.json({ success: true, ...(await qrData(req, session)) });
};

exports.getQrCode = async function (req, res) {
  const session = await db.get(
    `SELECT s.*, t.table_no FROM DiningSession s JOIN DiningTable t ON t.table_id = s.table_id
        WHERE s.qr_token = ? AND s.session_status = 'ACTIVE'`,
    [req.params.token]
  );
  check(session, 404, 'ไม่พบรอบบริการที่ยังเปิดอยู่');
  res.json({ success: true, ...(await qrData(req, session)) });
};

async function getBillSession(sessionId, connection = db) {
  const session = await connection.get(
    'SELECT s.*, t.table_no FROM DiningSession s JOIN DiningTable t ON t.table_id = s.table_id WHERE session_id = ?',
    [sessionId]
  );
  check(session, 404, 'ไม่พบรอบบริการ');
  return session;
}

exports.getBill = async function (req, res) {
  const data = await db.transaction(async (tx) => {
    const session = await getBillSession(req.params.sessionId, tx);
    const bill = await tx.get('SELECT * FROM Bill WHERE session_id = ?', [session.session_id]);
    if (bill?.bill_status === 'PAID') {
      check(
        bill.snapshot_json,
        409,
        'บิลเก่าไม่มีข้อมูลรายการ ณ เวลาชำระ จึงไม่สร้างใบเสร็จย้อนหลังจากราคาปัจจุบัน'
      );
      const payment = await tx.get(
        "SELECT * FROM Payment WHERE bill_id = ? AND payment_status = 'SUCCESS'",
        [bill.bill_id]
      );
      check(payment, 409, 'บิลนี้ไม่มีข้อมูลการชำระ กรุณาตรวจฐานข้อมูล');
      return { ...JSON.parse(bill.snapshot_json), bill, payment, paid: true };
    }
    check(session.session_status === 'ACTIVE', 409, 'รอบบริการปิดแล้ว');
    const items = await itemsFor(session.session_id, tx);
    return { session, items, ...totals(session, items), bill: null, payment: null, paid: false };
  });
  res.render('cashier/bill', { ...data, title: data.paid ? 'ใบเสร็จรับเงิน' : 'ตรวจสอบบิล' });
};

exports.processPayment = async function (req, res) {
  const { session_id } = req.body;
  id(session_id, 'รอบบริการ');
  const method =
    { QR: 'PROMPTPAY', CARD: 'CREDIT_CARD' }[req.body.payment_method] || req.body.payment_method;
  check(['CASH', 'PROMPTPAY', 'CREDIT_CARD'].includes(method), 400, 'ช่องทางชำระไม่ถูกต้อง');
  const received = money(req.body.amount_received);
  const expected = money(req.body.expected_total);
  const result = await db.transaction(async (tx) => {
    // ถ้ากดลองรับเงินซ้ำ ให้คืนใบเสร็จเดิม
    const existing = await tx.get(
      `SELECT b.*, p.amount_received, p.change_amount, p.payment_method FROM Bill b
            JOIN Payment p ON p.bill_id = b.bill_id AND p.payment_status = 'SUCCESS' WHERE b.session_id = ? AND b.bill_status = 'PAID'`,
      [session_id]
    );
    if (existing) {
      check(
        existing.payment_method === method &&
          money(existing.amount_received) === received &&
          money(existing.net_amount) === expected,
        409,
        'รอบนี้ชำระแล้วด้วยข้อมูลอื่น'
      );
      return {
        receipt_no: existing.receipt_no,
        net_amount: existing.net_amount,
        change_amount: existing.change_amount
      };
    }
    // ตรวจรอบบริการ อาหารที่ค้าง และยอดเงินก่อนบันทึก
    const session = await getBillSession(session_id, tx);
    check(session.session_status === 'ACTIVE', 409, 'รอบบริการปิดแล้ว');
    const items = await itemsFor(session_id, tx);
    check(
      items.every((i) => i.item_status === 'SERVED'),
      409,
      'กรุณาเสิร์ฟหรือยกเลิกอาหารที่ค้างก่อนชำระเงิน'
    );
    const amounts = totals(session, items);
    const net = money(amounts.netAmount);
    check(method !== 'PROMPTPAY' || net > 0, 400, 'ยอดพร้อมเพย์ต้องมากกว่า 0 บาท');
    check(expected === net, 409, 'ยอดบิลเปลี่ยนแล้ว กรุณาโหลดบิลล่าสุดก่อนรับเงิน');
    check(received >= net, 400, 'รับเงินไม่ครบ');
    check(method === 'CASH' || received === net, 400, 'พร้อมเพย์และบัตรต้องรับเท่ากับยอดสุทธิ');
    // บันทึกบิลและการชำระ แล้วคืนโต๊ะเป็นว่างใน transaction เดียวกัน
    const billId = randomUUID(),
      receiptNo = 'R-' + randomUUID();
    const snapshot = JSON.stringify({ session, items, ...amounts });
    await tx.run(
      `INSERT INTO Bill(bill_id,session_id,subtotal,tax_amount,before_rounding,rounding_amount,net_amount,bill_status,receipt_no,snapshot_json)
            VALUES(?,?,?,?,?,?,?,'PAID',?,?)`,
      [
        billId,
        session_id,
        amounts.subtotal,
        amounts.taxAmount,
        amounts.beforeRounding,
        amounts.roundingAmount,
        amounts.netAmount,
        receiptNo,
        snapshot
      ]
    );
    const change = (received - net) / 100;
    await tx.run(
      `INSERT INTO Payment(payment_id,bill_id,received_by,payment_method,amount,amount_received,change_amount,paid_at)
            VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        billId,
        req.staff.employee_id,
        method,
        amounts.netAmount,
        received / 100,
        change
      ]
    );
    await tx.run(
      "UPDATE DiningSession SET session_status = 'CLOSED', ends_at = CURRENT_TIMESTAMP WHERE session_id = ?",
      [session_id]
    );
    await tx.run("UPDATE DiningTable SET table_status = 'AVAILABLE' WHERE table_id = ?", [
      session.table_id
    ]);
    return {
      receipt_no: receiptNo,
      net_amount: amounts.netAmount,
      change_amount: change,
      table_id: session.table_id
    };
  });
  if (result.table_id) {
    emit(req, 'table-status-changed', { table_id: result.table_id, table_status: 'AVAILABLE' });
    emit(req, 'session-closed', { session_id });
  }
  res.json({ success: true, ...result, receipt_url: '/cashier/bill/' + session_id });
};

exports.resetTable = async function (req, res) {
  const { table_id } = req.body;
  id(table_id, 'รหัสโต๊ะ');
  const session = await db.transaction(async (tx) => {
    const table = await tx.get('SELECT * FROM DiningTable WHERE table_id = ?', [table_id]);
    check(table, 404, 'ไม่พบโต๊ะ');
    const active = await tx.get(
      "SELECT * FROM DiningSession WHERE table_id = ? AND session_status = 'ACTIVE'",
      [table_id]
    );
    check(
      req.body.expected_status === table.table_status &&
        (req.body.expected_session_id || null) === (active?.session_id || null),
      409,
      'สถานะโต๊ะเปลี่ยนแล้ว กรุณาดูข้อมูลล่าสุดก่อนรีเซ็ต'
    );
    if (active) {
      const count = await tx.get(
        `SELECT COUNT(*) n FROM OrderItem oi JOIN FoodOrder fo ON fo.order_id = oi.order_id
                WHERE fo.session_id = ? AND oi.item_status != 'CANCELLED'`,
        [active.session_id]
      );
      check(count.n === 0, 409, 'โต๊ะมีรายการอาหาร กรุณาเช็กบิลก่อนรีเซ็ต');
      await tx.run(
        "UPDATE DiningSession SET session_status = 'CANCELLED', ends_at = CURRENT_TIMESTAMP WHERE session_id = ?",
        [active.session_id]
      );
    }
    await tx.run("UPDATE DiningTable SET table_status = 'AVAILABLE' WHERE table_id = ?", [
      table_id
    ]);
    return active;
  });
  if (session) {
    emit(req, 'session-closed', { session_id: session.session_id });
  }
  emit(req, 'table-status-changed', { table_id, table_status: 'AVAILABLE' });
  res.json({ success: true });
};

exports.getReceipts = async function (req, res) {
  const receipts =
    await db.query(`SELECT b.*, t.table_no, p.paid_at FROM Bill b JOIN DiningSession s ON s.session_id = b.session_id
        JOIN DiningTable t ON t.table_id = s.table_id JOIN Payment p ON p.bill_id = b.bill_id AND p.payment_status = 'SUCCESS'
        WHERE b.bill_status = 'PAID' ORDER BY p.rowid DESC LIMIT 200`);
  res.render('cashier/receipts', { receipts, title: 'ใบเสร็จย้อนหลัง' });
};
