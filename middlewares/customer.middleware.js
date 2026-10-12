const db = require('../database/database');
const { wantsHtml } = require('./auth.middleware');

// ตรวจรอบบริการก่อนเข้าเมนู ส่งออเดอร์ หรือดูสถานะอาหาร
async function requireDiningSession(req, res, next) {
  // token มาได้ 3 ทาง: query string, body (ตอนส่งออเดอร์), หรือ cookie ที่ตั้งไว้ตอนสแกน QR
  const token = req.query.token || req.body?.token || req.cookies?.qr_token;
  const deny = (message) =>
    wantsHtml(req)
      ? res.status(400).render('error', { message })
      : res.status(400).json({ success: false, message });
  if (typeof token !== 'string' || !token || token.length > 100) {
    return deny('กรุณาสแกน QR Code เพื่อเข้าสู่หน้าสั่งอาหาร');
  }
  const session = await db.get(
    `SELECT s.*, t.table_no FROM DiningSession s
     JOIN DiningTable t ON s.table_id = t.table_id WHERE s.qr_token = ?`,
    [token]
  );
  if (!session || (session.session_status !== 'ACTIVE' && req.method !== 'POST')) {
    return deny('รอบการใช้บริการของคุณจบแล้วหรือ QR Code ไม่ถูกต้อง');
  }
  req.diningSession = session;
  req.qrToken = token;
  next();
}
module.exports = { requireDiningSession };
