const db = require('../database/database');
const QRCode = require('qrcode');
const ejs = require('ejs');
const path = require('path');
const { getPublicUrl } = require('../utils/tunnel');
const { fail, today } = require('../utils/validation');
const { openSession, setTableStatus } = require('../utils/sessions');
const { totals, itemsFor } = require('../utils/billing');
const { thaiDay, thaiTime } = require('../utils/datetime');

// อ่านสถานะโต๊ะและคิวรอ เพื่อแสดงผังโต๊ะกับจำนวนรวม
function getTables(req, res) {
  const sql = `SELECT diningTable.*, diningSession.session_id, diningSession.qr_token,
    diningSession.guest_count, diningSession.started_at
    FROM DiningTable diningTable LEFT JOIN DiningSession diningSession
    ON diningTable.table_id = diningSession.table_id AND diningSession.session_status = 'ACTIVE'
    ORDER BY CAST(diningTable.table_no AS INTEGER)`;
  const tables = db.query(sql);
  const waitingQueues = db.query(
    `SELECT * FROM QueueTicket
      WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')`,
    [today()]
  );
  const availableTables = tables.filter(function (table) {
    return table.table_status === 'AVAILABLE';
  });
  res.render('cashier/tables', {
    tables,
    waitingQueues,
    availableTables,
    availableCount: availableTables.length,
    occupiedCount: tables.length - availableTables.length,
    queueDate: today(),
    title: 'จัดการโต๊ะและคิว'
  });
}

// สร้าง QR ลิงก์ลูกค้า และ HTML ใบเปิดโต๊ะ
async function qrData(req, session) {
  const url = getPublicUrl(req) + '/qr/' + session.qr_token;
  // session เป็นข้อมูลที่อ่านจากฐานข้อมูลใหม่ จึงเพิ่มข้อมูลใบ QR ได้เลย
  session.customer_url = url;
  session.buffet_totals = totals(session, []);
  session.qr_image = await QRCode.toDataURL(url);
  const template = path.join(__dirname, '../views/cashier/partials/table-slip-content.ejs');
  session.slip_html = await ejs.renderFile(template, {
    slip: session,
    thaiDay,
    thaiTime
  });
  session.success = true;
  return session;
}

// เปิดรอบบริการใหม่ แล้วส่งใบ QR กลับให้หน้าจอ
async function openTable(req, res) {
  const session = openSession(req.body, req.staff.employee_id);
  res.json(await qrData(req, session));
}

// อ่านโต๊ะที่เปิดอยู่ เพื่อแสดงหรือพิมพ์ใบ QR ซ้ำ
async function getQrCode(req, res) {
  const sql = `SELECT diningSession.*, diningTable.table_no FROM DiningSession diningSession
    JOIN DiningTable diningTable ON diningTable.table_id = diningSession.table_id
    WHERE diningSession.qr_token = ? AND diningSession.session_status = 'ACTIVE'`;
  const session = db.get(sql, [req.params.token]);
  if (!session) fail('ไม่พบโต๊ะที่เปิดอยู่', 404);
  res.json(await qrData(req, session));
}

// ยกเลิกโต๊ะที่เปิดผิดและยังไม่มีอาหาร แล้วคืนโต๊ะเป็นว่าง
function resetTable(req, res) {
  db.transaction(function () {
    const session = db.get(
      `SELECT * FROM DiningSession
        WHERE table_id = ? AND session_status = 'ACTIVE'`,
      [req.body.table_id]
    );
    if (session) {
      if (itemsFor(session.session_id).length > 0) fail('โต๊ะมีอาหารแล้ว กรุณาเช็กบิล', 409);
      db.run(
        `UPDATE DiningSession
          SET session_status = 'CANCELLED', ends_at = CURRENT_TIMESTAMP
          WHERE session_id = ?`,
        [session.session_id]
      );
      setTableStatus(session.table_id, 'AVAILABLE');
    }
  });
  res.json({ success: true });
}

module.exports = { getTables, openTable, getQrCode, resetTable };
