// ส่งข้อความผิดพลาดเป็นหน้า EJS หรือ JSON ตามคำขอ
function sendError(req, res, status, message) {
  res.status(status);
  const accept = req.get('accept') || '';
  if (accept.includes('text/html')) {
    res.render('error', { message });
  } else {
    res.json({ success: false, message });
  }
}

// รับข้อผิดพลาดจากเว็บ และซ่อนรายละเอียดระบบเมื่อเกิดรหัส 500
function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  let message = error.message;
  if (status === 500) {
    console.error(error.message);
    message = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }
  sendError(req, res, status, message);
}
module.exports = { sendError, errorHandler };
