// ตั้งค่าเว็บ เชื่อมฐานข้อมูล และเปิดเซิร์ฟเวอร์
const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { getSessionSecret } = require('./utils/session-secret');
const { thaiDate, thaiTime } = require('./utils/datetime');
const app = express();
const server = http.createServer(app);
// ตั้งค่าเว็บ
app.locals.thaiDate = thaiDate;
app.locals.thaiTime = thaiTime;
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
const SESSION_SECRET = getSessionSecret();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (!req.body) req.body = {};
  next();
});
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));
const db = require('./database/database');
// เส้นทางและสิทธิ์เข้าใช้งาน
const { requireRole, HOME_BY_ROLE } = require('./middlewares/auth.middleware');
const { requireDiningSession } = require('./middlewares/customer.middleware');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const PORT = process.env.PORT || 3000;
app.locals.HOME_BY_ROLE = HOME_BY_ROLE;
app.use('/', require('./routes/auth.routes'));
app.use('/kitchen', requireRole('KITCHEN'));
app.use('/serving', requireRole('SERVICE'));
app.use('/cashier', requireRole('CASHIER'));
app.use(['/menu', '/orders'], requireDiningSession);
app.use('/', require('./routes/customer.routes'));
app.use('/', require('./routes/kitchen.routes'));
app.use('/', require('./routes/serving.routes'));
app.use('/', require('./routes/cashier.routes'));
app.use('/', require('./routes/queue.routes'));
app.get('/', (req, res) => res.redirect('/login'));
// ต้องอยู่ท้ายสุดหลัง route ทั้งหมด
app.use(notFound);
app.use(errorHandler);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      ` PORT : ${PORT} ถูกใช้งานอยู่แล้ว ปิดโปรแกรมที่ใช้พอร์ตนี้ก่อน หรือเปลี่ยน PORT`
    );
    process.exit(1);
  } else {
    throw err;
  }
});

// รอฐานข้อมูลพร้อม แล้วเปิดเว็บและแสดงลิงก์เข้าใช้งาน
async function start(port = PORT) {
  await db.ready;
  return server.listen(port, '0.0.0.0', () => {
    const listeningPort = server.address().port;
    const local = 'http://localhost:' + listeningPort;
    console.log(`=======================================================
🔥 Moo Krata Restaurant QR System running on:
👉 Local: ${local}
👉 Cashier: ${local}/cashier/tables
👉 Kitchen: ${local}/kitchen
👉 Serving: ${local}/serving
=======================================================`);
    // ตัวเปิด Cloudflare ส่ง PUBLIC_URL ให้เว็บก่อนเริ่ม Server
    if (process.env.PUBLIC_URL) {
      console.log(`🌐 Public Customer URL: ${process.env.PUBLIC_URL}`);
      console.log(`=======================================================`);
    }
  });
}
if (require.main === module) {
  start().catch((err) => {
    console.error('Startup failed:', err.message);
    process.exitCode = 1;
    db.db.close();
  });
}
module.exports = { app, server, start };
