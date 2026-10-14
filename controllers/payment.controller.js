const db = require('../database/database');
const { randomUUID } = require('crypto');
const { fail, money } = require('../utils/validation');
const { setTableStatus } = require('../utils/sessions');
const { totals, itemsFor } = require('../utils/billing');
// อ่านรอบบริการและหมายเลขโต๊ะสำหรับบิล
function getBillSession(sessionId) {
  const sql = `SELECT diningSession.*, diningTable.table_no FROM DiningSession diningSession
    JOIN DiningTable diningTable ON diningTable.table_id = diningSession.table_id
    WHERE diningSession.session_id = ?`;
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
  db.transaction(function () {
    // 1. ตรวจว่าบิลยังไม่ได้จ่าย และอาหารไม่มีรายการค้าง
    const existingBill = db.get('SELECT * FROM Bill WHERE session_id = ?', [sessionId]);
    if (existingBill) return;
    const session = getBillSession(sessionId);
    if (session.session_status !== 'ACTIVE') fail('รอบบริการปิดแล้ว', 409);
    const items = itemsFor(sessionId);
    for (const item of items) {
      if (item.item_status !== 'SERVED') fail('กรุณาเสิร์ฟหรือยกเลิกอาหารที่ค้างก่อน', 409);
    }
    if (!['CASH', 'PROMPTPAY', 'CREDIT_CARD'].includes(method)) fail('วิธีชำระเงินไม่ถูกต้อง');

    // 2. คิดยอดสุทธิและเงินทอนเป็นสตางค์
    const amounts = totals(session, items);
    const netCents = money(amounts.netAmount);
    const received = money(req.body.amount_received);
    if (money(req.body.expected_total) !== netCents)
      fail('ยอดบิลเปลี่ยนแล้ว กรุณาโหลดบิลใหม่', 409);
    if (received < netCents || (method !== 'CASH' && received !== netCents))
      fail('ยอดรับเงินไม่ถูกต้อง');
    const change = (received - netCents) / 100;
    const billId = randomUUID();
    const receiptNo = 'R-' + randomUUID().slice(0, 8).toUpperCase();
    amounts.session = session;
    amounts.items = items;

    // 3. บันทึกบิล การรับเงิน แล้วคืนโต๊ะเป็นว่าง
    const billSql = `INSERT INTO Bill
      (bill_id, session_id, subtotal, tax_amount,
       before_rounding, rounding_amount, net_amount, bill_status, receipt_no, snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)`;
    db.run(billSql, [
      billId, sessionId, amounts.subtotal, amounts.taxAmount,
      amounts.beforeRounding, amounts.roundingAmount, amounts.netAmount,
      receiptNo, JSON.stringify(amounts)
    ]);
    const paymentSql = `INSERT INTO Payment (payment_id, bill_id, received_by,
      payment_method, amount, amount_received, change_amount,
      paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    db.run(paymentSql, [
      randomUUID(), billId, req.staff.employee_id, method,
      amounts.netAmount, received / 100, change
    ]);
    db.run(
      `UPDATE DiningSession
        SET session_status = 'CLOSED', ends_at = CURRENT_TIMESTAMP
        WHERE session_id = ?`,
      [sessionId]
    );
    setTableStatus(session.table_id, 'AVAILABLE');
  });
  res.json({ success: true, receipt_url: '/cashier/bill/' + sessionId });
}

// อ่านใบเสร็จล่าสุดไม่เกิน 200 ใบ เพื่อแสดงประวัติ
function getReceipts(req, res) {
  const sql = `SELECT bill.*, diningTable.table_no, payment.paid_at FROM Bill bill
    JOIN DiningSession diningSession ON diningSession.session_id = bill.session_id
    JOIN DiningTable diningTable ON diningTable.table_id = diningSession.table_id
    JOIN Payment payment ON payment.bill_id = bill.bill_id ORDER BY payment.rowid DESC LIMIT 200`;
  const receipts = db.query(sql);
  res.render('cashier/receipts', { receipts, title: 'ใบเสร็จย้อนหลัง' });
}

module.exports = { getBill, processPayment, getReceipts };
