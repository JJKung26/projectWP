const db = require('../database/database');
const { sendError } = require('./error.middleware');

// อ่าน token จาก URL หรือข้อมูลที่ส่ง แล้วหาโต๊ะของลูกค้า
function requireDiningSession(req, res, next) {
  let token = req.query.token;
  if (!token && req.body) token = req.body.token;
  const sql = `SELECT s.*, t.table_no FROM DiningSession s
    JOIN DiningTable t ON t.table_id = s.table_id WHERE s.qr_token = ?`;
  const session = db.get(sql, [token || '']);
  if (!session || session.session_status !== 'ACTIVE') {
    sendError(req, res, 400, 'QR Code ไม่ถูกต้องหรือรอบบริการจบแล้ว');
    return;
  }
  // ส่งข้อมูลรอบบริการให้ controller และ EJS ใช้ต่อ
  req.diningSession = session;
  res.locals.session = session;
  res.locals.token = token;
  next();
}
module.exports = { requireDiningSession };
