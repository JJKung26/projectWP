// ส่งข้อความเมื่อข้อมูลผิด หรือเกิดข้อผิดพลาด
const { wantsHtml } = require('./auth.middleware');

// ส่งหน้าแจ้งเตือนหรือ JSON ตามชนิดคำขอ
function sendError(req, res, status, message) {
  res.status(status);
  if (wantsHtml(req)) return res.render('error', { message });
  return res.json({ success: false, message });
}

// URL ที่ไม่ตรงกับ route ไหนเลย
function notFound(req, res) {
  return sendError(req, res, 404, 'ไม่พบหน้าที่คุณต้องการ');
}

// Express ส่งข้อผิดพลาดมาที่ฟังก์ชันที่รับ 4 พารามิเตอร์นี้
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  if (!err.status && err.type === 'entity.parse.failed') status = 400;
  if (status >= 500) {
    console.error('Server error:', err.message);
  }
  let message = 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง';
  if (status < 500 || err.expose) message = err.message;
  return sendError(req, res, status, message);
}
module.exports = { notFound, errorHandler, sendError };
