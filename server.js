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

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
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
const PORT = process.env.PORT || 3000;

// Use Routes
app.use('/', customerRoutes);
app.use('/', kitchenRoutes);
app.use('/', servingRoutes);
app.use('/', cashierRoutes);
app.use('/', queueRoutes);

// Home route default to cashier tables
app.get('/', (req, res) => {
    res.redirect('/cashier/tables');
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
