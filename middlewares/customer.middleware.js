// ตรวจ QR และรอบบริการของลูกค้าก่อนให้ใช้งาน
const db = require('../database/database');
const { sendError } = require('./error.middleware');

// ตรวจรอบบริการก่อนเข้าเมนู ส่งออเดอร์ หรือดูสถานะอาหาร
async function requireDiningSession(req, res, next) {
  // token มาได้ 3 ทาง: query string, body (ตอนส่งออเดอร์), หรือ cookie ที่ตั้งไว้ตอนสแกน QR
  const token = req.query.token || req.body?.token || req.cookies?.qr_token;
  if (typeof token !== 'string' || !token || token.length > 100) {
    return sendError(req, res, 400, 'กรุณาสแกน QR Code เพื่อเข้าสู่หน้าสั่งอาหาร');
  }
  const session = await db.get(
    `SELECT s.*, t.table_no FROM DiningSession s
     JOIN DiningTable t ON s.table_id = t.table_id WHERE s.qr_token = ?`,
    [token]
  );
  if (!session || (session.session_status !== 'ACTIVE' && req.method !== 'POST')) {
    return sendError(req, res, 400, 'รอบการใช้บริการของคุณจบแล้วหรือ QR Code ไม่ถูกต้อง');
  }
  req.diningSession = session;
  req.qrToken = token;
  next();
}
module.exports = { requireDiningSession };
