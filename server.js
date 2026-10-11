const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { getSessionSecret } = require('./utils/session-secret');
const { thaiDate, thaiTime } = require('./utils/datetime');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store io in app context
app.set('socketio', io);

Object.assign(app.locals, { thaiDate, thaiTime });
// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const SESSION_SECRET = getSessionSecret();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    req.body ??= {};
    next();
});
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database connection & tables
const db = require('./database/database');

// Import Routes
const customerRoutes = require('./routes/customer.routes');
const kitchenRoutes = require('./routes/kitchen.routes');
const servingRoutes = require('./routes/serving.routes');
const cashierRoutes = require('./routes/cashier.routes');
const queueRoutes = require('./routes/queue.routes');
const authRoutes = require('./routes/auth.routes');
const { requireRole } = require('./middlewares/auth.middleware');
const { requireDiningSession } = require('./middlewares/customer.middleware');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const PORT = process.env.PORT || 3000;

// Use Routes
app.use('/', authRoutes); // ต้องอยู่ก่อน guard เพราะหน้า login ต้องเข้าได้โดยไม่ต้องล็อกอิน

// ตรวจสิทธิ์ที่ path prefix ตอน mount — ครอบทุก route ใต้ prefix นั้นในครั้งเดียว
// จึงไม่ต้องแก้ไฟล์ routes/*.js เดิม และไม่มีทางลืมใส่ตอนเพิ่ม route ใหม่
// หมายเหตุ: '/cashier' ครอบ queue.routes.js ให้ด้วย เพราะทุก path เป็น /cashier/queue/*
app.use('/kitchen', requireRole('KITCHEN'));
app.use('/serving', requireRole('SERVICE'));
app.use('/cashier', requireRole('CASHIER'));

app.use(['/menu', '/orders'], requireDiningSession());
app.use('/', customerRoutes);
app.use('/', kitchenRoutes);
app.use('/', servingRoutes);
app.use('/', cashierRoutes);
app.use('/', queueRoutes);

// หน้าแรกพาไปหน้าเข้าสู่ระบบ
app.get('/', (req, res) => {
    res.redirect('/login');
});

// ต้องอยู่ท้ายสุดหลัง route ทั้งหมด
app.use(notFound);
app.use(errorHandler);

// ยืนยันสิทธิ์ก่อนให้ Socket เข้าห้องบทบาทหรือโต๊ะ
const { resolveStaff } = require('./middlewares/auth.middleware');
io.use(async (socket, next) => {
    try {
        const req = socket.request;
        cookieParser(SESSION_SECRET)(req, {}, () => {});
        const { role, token } = socket.handshake.auth;
        if (token !== undefined && typeof token !== 'string')
            return next(new Error('QR ไม่ถูกต้อง'));
        if (role) {
            if (!['CASHIER', 'KITCHEN', 'SERVICE', 'ADMIN'].includes(role))
                return next(new Error('ไม่มีสิทธิ์'));
            const staff = await resolveStaff(req, role);
            if (!staff) return next(new Error('กรุณาเข้าสู่ระบบ'));
            socket.data.room = 'staff:' + role;
        } else {
            const session = await db.get(
                "SELECT session_id FROM DiningSession WHERE qr_token = ? AND session_status = 'ACTIVE'",
                [token || '']
            );
            if (!session) return next(new Error('รอบบริการปิดแล้วหรือ QR ไม่ถูกต้อง'));
            socket.data.room = 'session:' + session.session_id;
            socket.data.customer = true;
        }
        next();
    } catch (err) {
        next(err);
    }
});
io.on('connection', socket => {
    socket.join(socket.data.room);
    if (socket.data.customer) socket.join('customers');
});

server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            ` PORT : ${PORT} ถูกใช้งานอยู่แล้ว ปิดโปรแกรมที่ใช้พอร์ตนี้ก่อน หรือเปลี่ยน PORT`
        );
        process.exit(1);
    } else {
        throw err;
    }
});

async function start(port = PORT) {
    await db.ready;
    return server.listen(port, '0.0.0.0', () => {
        const listeningPort = server.address().port;
        console.log(`=======================================================`);
        console.log(`🔥 Moo Krata Restaurant QR System running on:`);
        console.log(`👉 Local: http://localhost:${listeningPort}`);
        console.log(`👉 Cashier: http://localhost:${listeningPort}/cashier/tables`);
        console.log(`👉 Kitchen: http://localhost:${listeningPort}/kitchen`);
        console.log(`👉 Serving: http://localhost:${listeningPort}/serving`);
        console.log(`=======================================================`);

        // ตัวเปิด Cloudflare ส่ง PUBLIC_URL ให้เว็บก่อนเริ่ม Server
        if (process.env.PUBLIC_URL) {
            console.log(`🌐 Public Customer URL: ${process.env.PUBLIC_URL}`);
            console.log(`=======================================================`);
        }
    });
}
if (require.main === module)
    start().catch(err => {
        console.error('Startup failed:', err.message);
        process.exitCode = 1;
        db.db.close();
    });
module.exports = { app, server, io, start };
