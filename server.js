const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store io in app context
app.set('socketio', io);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// กุญแจสำหรับเซ็นชื่อ cookie — กันคนแก้ค่า cookie เองเพื่อปลอมเป็นพนักงานบทบาทอื่น
// ย้ายไปเก็บใน .env ภายหลังได้โดยเปลี่ยนเป็น:
//   const SESSION_SECRET = process.env.SESSION_SECRET || 'moo-krata-dev-secret-2026';
const SESSION_SECRET = 'moo-krata-dev-secret-2026';

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database connection & tables
const db = require('./database/database');

// Import Tunnelmole utility
const tunnel = require('./utils/tunnel');

// Import Routes
const customerRoutes = require('./routes/customer.routes');
const kitchenRoutes = require('./routes/kitchen.routes');
const servingRoutes = require('./routes/serving.routes');
const cashierRoutes = require('./routes/cashier.routes');
const queueRoutes = require('./routes/queue.routes');
const authRoutes = require('./routes/auth.routes');
const { requireRole } = require('./middlewares/auth.middleware');
const PORT = process.env.PORT || 3000;

// Use Routes
app.use('/', authRoutes);   // ต้องอยู่ก่อน guard เพราะหน้า login ต้องเข้าได้โดยไม่ต้องล็อกอิน

// ตรวจสิทธิ์ที่ path prefix ตอน mount — ครอบทุก route ใต้ prefix นั้นในครั้งเดียว
// จึงไม่ต้องแก้ไฟล์ routes/*.js เดิม และไม่มีทางลืมใส่ตอนเพิ่ม route ใหม่
// หมายเหตุ: '/cashier' ครอบ queue.routes.js ให้ด้วย เพราะทุก path เป็น /cashier/queue/*
app.use('/kitchen', requireRole('KITCHEN'));
app.use('/serving', requireRole('SERVICE'));
app.use('/cashier', requireRole('CASHIER'));

app.use('/', customerRoutes);
app.use('/', kitchenRoutes);
app.use('/', servingRoutes);
app.use('/', cashierRoutes);
app.use('/', queueRoutes);

// หน้าแรกพาไปหน้าเข้าสู่ระบบ
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Socket.IO connections
io.on('connection', (socket) => {
    console.log('⚡ Client connected to Socket.IO:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});


server.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(`🔥 Moo Krata Restaurant QR System running on:`);
    console.log(`👉 Local: http://localhost:${PORT}`);
    console.log(`👉 Cashier: http://localhost:${PORT}/cashier/tables`);
    console.log(`👉 Kitchen: http://localhost:${PORT}/kitchen`);
    console.log(`👉 Serving: http://localhost:${PORT}/serving`);
    console.log(`=======================================================`);

    // Initialize Tunnelmole for public QR Code access
    try {
        const publicUrl = await tunnel.startTunnel(PORT);
        if (publicUrl) {
            app.set('publicUrl', publicUrl);
            console.log(`🌐 Public Customer URL (Tunnelmole): ${publicUrl}`);
            console.log(`=======================================================`);
        }
    } catch (err) {
        console.warn('⚠️ Tunnelmole warning:', err.message);
    }
});
