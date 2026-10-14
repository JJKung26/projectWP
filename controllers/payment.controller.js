const db = require('../database/database');
const { randomUUID } = require('crypto');
const { fail, money } = require('../utils/validation');
const { setTableStatus } = require('../utils/sessions');
const { totals, itemsFor } = require('../utils/billing');
// อ่านรอบบริการและหมายเลขโต๊ะสำหรับบิล
function getBillSession(sessionId) {
  const sql = `SELECT s.*, t.table_no FROM DiningSession s
    JOIN DiningTable t ON t.table_id = s.table_id WHERE s.session_id = ?`;
  const session = db.get(sql, [sessionId]);
  if (!session) fail('ไม่พบรอบบริการ', 404);
  return session;
}

// แสดงยอดปัจจุบัน หรือใบเสร็จจากราคาที่บันทึกตอนจ่ายเงิน
function getBill(req, res) {
  const session = getBillSession(req.params.sessionId);
  const bill = db.get('SELECT * FROM Bill WHERE session_id = ?', [session.session_id]);
  let data;
  if (bill) {
    // ใบเสร็จอ่านราคาที่บันทึกตอนจ่ายเงิน
    data = JSON.parse(bill.snapshot_json);
    data.bill = bill;
    data.payment = db.get('SELECT * FROM Payment WHERE bill_id = ?', [bill.bill_id]);
    data.paid = true;
    data.title = 'ใบเสร็จรับเงิน';
  } else {
    if (session.session_status !== 'ACTIVE') fail('รอบบริการปิดแล้ว', 409);
    const items = itemsFor(session.session_id);
    data = totals(session, items);
    data.session = session;
    data.items = items;
    data.paid = false;
    data.title = 'ตรวจสอบบิล';
  }
  res.render('cashier/bill', data);
}

// รับชำระเงิน บันทึกบิลและเงินทอน แล้วปิดรอบบริการ
function processPayment(req, res) {
  const sessionId = req.body.session_id;
  const method = req.body.payment_method;
  const result = db.transaction(function () {
    // 1. ตรวจว่าบิลยังไม่ได้จ่าย และอาหารไม่มีรายการค้าง
    const old = db.get('SELECT * FROM Bill WHERE session_id = ?', [sessionId]);
    if (old) return { receipt_no: old.receipt_no, net_amount: old.net_amount };
    const session = getBillSession(sessionId);
    if (session.session_status !== 'ACTIVE') fail('รอบบริการปิดแล้ว', 409);
    const items = itemsFor(sessionId);
    for (const item of items) {
      if (item.item_status !== 'SERVED') fail('กรุณาเสิร์ฟหรือยกเลิกอาหารที่ค้างก่อน', 409);
    }
    if (!['CASH', 'PROMPTPAY', 'CREDIT_CARD'].includes(method)) fail('วิธีชำระเงินไม่ถูกต้อง');

    // 2. คิดยอดสุทธิและเงินทอนเป็นสตางค์
    const amounts = totals(session, items);
    const net = money(amounts.netAmount);
    const received = money(req.body.amount_received);
    if (money(req.body.expected_total) !== net) fail('ยอดบิลเปลี่ยนแล้ว กรุณาโหลดบิลใหม่', 409);
    if (received < net || (method !== 'CASH' && received !== net)) fail('ยอดรับเงินไม่ถูกต้อง');
    const change = (received - net) / 100;
    const billId = randomUUID();
    const receiptNo = 'R-' + randomUUID().slice(0, 8).toUpperCase();
    amounts.session = session;
    amounts.items = items;

    // 3. บันทึกบิล การรับเงิน แล้วคืนโต๊ะเป็นว่าง
    const billSql = `INSERT INTO Bill
      (bill_id, session_id, subtotal, tax_amount,
       before_rounding, rounding_amount, net_amount, bill_status, receipt_no, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)`;
    const billValues = [
      billId,
      sessionId,
      amounts.subtotal,
      amounts.taxAmount,
      amounts.beforeRounding,
      amounts.roundingAmount,
      amounts.netAmount,
      receiptNo,
      JSON.stringify(amounts)
    ];
    db.run(billSql, billValues);
    const paymentSql = `INSERT INTO Payment (payment_id, bill_id, received_by,
      payment_method, amount, amount_received, change_amount,
      paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    const paymentValues = [
      randomUUID(),
      billId,
      req.staff.employee_id,
      method,
      amounts.netAmount,
      received / 100,
      change
    ];
    db.run(paymentSql, paymentValues);
    db.run(
      `UPDATE DiningSession
        SET session_status = 'CLOSED', ends_at = CURRENT_TIMESTAMP
        WHERE session_id = ?`,
      [sessionId]
    );
    setTableStatus(session.table_id, 'AVAILABLE');
    return {
      receipt_no: receiptNo,
      net_amount: amounts.netAmount,
      change_amount: change
    };
  });
  result.success = true;
  result.receipt_url = '/cashier/bill/' + sessionId;
  res.json(result);
}

// อ่านใบเสร็จล่าสุดไม่เกิน 200 ใบ เพื่อแสดงประวัติ
function getReceipts(req, res) {
  const sql = `SELECT b.*, t.table_no, p.paid_at FROM Bill b
    JOIN DiningSession s ON s.session_id = b.session_id
    JOIN DiningTable t ON t.table_id = s.table_id
    JOIN Payment p ON p.bill_id = b.bill_id ORDER BY p.rowid DESC LIMIT 200`;
  const receipts = db.query(sql);
  res.render('cashier/receipts', { receipts, title: 'ใบเสร็จย้อนหลัง' });
}

module.exports = { getBill, processPayment, getReceipts };
