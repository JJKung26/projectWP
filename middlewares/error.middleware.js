const { wantsHtml } = require('./auth.helpers');

// URL ที่ไม่ตรงกับ route ไหนเลย
function notFound(req, res) {
    const message = 'ไม่พบหน้าที่คุณต้องการ';
    if (wantsHtml(req)) {
        return res.status(404).render('error', { message });
    }
    res.status(404).json({ success: false, message });
}

// Express 5 ส่ง error จาก async controller มาที่นี่ให้อัตโนมัติ
// (Express 4 ทำไม่ได้ ต้องเขียน try/catch เองทุกที่)
// ต้องรับครบ 4 พารามิเตอร์ Express ถึงจะรู้ว่านี่คือ error handler
function errorHandler(err, req, res, _next) {
    console.error('เกิดข้อผิดพลาดที่ไม่ได้จัดการ:', err);

    const message = 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง';
    if (wantsHtml(req)) {
        return res.status(500).render('error', { message });
    }
    res.status(500).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
