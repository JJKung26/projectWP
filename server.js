// โหลดเครื่องมือเว็บ คุกกี้ และฟังก์ชันกลาง
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { randomBytes } = require('crypto');
const { thaiDate, thaiTime } = require('./utils/datetime');
const { requireRole, HOME_BY_ROLE } = require('./middlewares/auth.middleware');
const { requireDiningSession } = require('./middlewares/customer.middleware');
const { sendError, errorHandler } = require('./middlewares/error.middleware');
const app = express();

// ตั้งค่า EJS ฟังก์ชันแสดงเวลา และการอ่านข้อมูลจากฟอร์ม
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.thaiDate = thaiDate;
app.locals.thaiTime = thaiTime;
app.locals.HOME_BY_ROLE = HOME_BY_ROLE;
app.locals.scripts = [];
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(randomBytes(32).toString('hex')));
app.use(express.static(path.join(__dirname, 'public')));

// ตรวจสิทธิ์ก่อนเข้าแต่ละส่วนของร้าน
app.use('/cashier', requireRole('CASHIER'));
app.use('/kitchen', requireRole('KITCHEN'));
app.use('/serving', requireRole('SERVICE'));
app.use(['/menu', '/orders'], requireDiningSession);
// เชื่อม URL ของเว็บ และแสดงข้อผิดพลาดเมื่อไม่พบหน้า
app.use(require('./routes'));
app.get('/', function (req, res) {
  res.redirect('/login');
});
app.use(function (req, res) {
  sendError(req, res, 404, 'ไม่พบหน้าที่ต้องการ');
});
app.use(errorHandler);

// เปิดเว็บ ถ้าพอร์ตถูกใช้ให้ลองหมายเลขถัดไป
function start(port = process.env.PORT || 3000, onReady) {
  port = Number(port);
  const server = app.listen(port, '0.0.0.0');
  server.on('error', function (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    console.log('พอร์ต ' + port + ' ถูกใช้แล้ว ลองพอร์ต ' + (port + 1));
    server.listen(++port, '0.0.0.0');
  });
  server.on('listening', function () {
    const actualPort = server.address().port;
    if (onReady) onReady(actualPort);
    else {
      console.log('Web: http://localhost:' + actualPort);
      if (process.env.PUBLIC_URL) console.log('Public: ' + process.env.PUBLIC_URL);
    }
  });
  return server;
}

// เริ่มเว็บเมื่อรันไฟล์นี้ หรือส่ง app ให้ Cloudflare ใช้งาน
if (require.main === module) start();
module.exports = { app, start };
