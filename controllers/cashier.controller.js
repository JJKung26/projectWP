const db = require('../database/database');
const QRCode = require('qrcode');
const crypto = require('crypto');
const tunnel = require('../utils/tunnel');

// Get all 50 tables, active sessions, and waiting queues
exports.getTables = async (req, res) => {
    try {
        const tables = await db.query(`
            SELECT t.*, s.session_id, s.qr_token, s.guest_count, s.started_at, s.buffet_price
            FROM DiningTable t
            LEFT JOIN DiningSession s ON t.table_id = s.table_id AND s.session_status = 'ACTIVE'
            ORDER BY CAST(t.table_no AS INTEGER) ASC
        `);

        const today = new Date().toISOString().split('T')[0];
        const waitingQueues = await db.query(`
            SELECT * FROM QueueTicket
            WHERE queue_date = ? AND queue_status IN ('WAITING', 'CALLED')
            ORDER BY queue_ticket_id ASC
        `, [today]);

        const availableCount = tables.filter(t => t.table_status === 'AVAILABLE').length;
        const occupiedCount = tables.filter(t => t.table_status === 'OCCUPIED').length;

        res.render('cashier/tables', {
            tables,
            waitingQueues,
            availableCount,
            occupiedCount,
            tunnelUrl: tunnel.getCurrentTunnelUrl(),
            title: 'จัดการโต๊ะอาหาร & บัตรคิว - แคชเชียร์'
        });
    } catch (err) {
        console.error('Error fetching cashier tables:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลโต๊ะ' });
    }
};

// Open a new table session & generate QR Token with Tunnelmole URL
exports.openTable = async (req, res) => {
    const { table_id, guest_count, buffet_price, queue_ticket_id } = req.body;
    const employee_id = req.body.employee_id || 'EMP-001';

    try {
        // Verify table availability
        const table = await db.get('SELECT * FROM DiningTable WHERE table_id = ?', [table_id]);
        if (!table) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลโต๊ะ' });
        }
        if (table.table_status === 'OCCUPIED') {
            return res.status(400).json({ success: false, message: 'โต๊ะนี้มีผู้ใช้งานอยู่แล้ว' });
        }

        const sessionId = 'SES-' + Date.now();
        const qrToken = 'QR-' + table.table_no + '-' + crypto.randomBytes(4).toString('hex');
        const price = parseFloat(buffet_price) || 219.0;
        const count = parseInt(guest_count) || 1;

        // Create DiningSession
        await db.run(`
            INSERT INTO DiningSession (session_id, table_id, opened_by, queue_ticket_id, qr_token, guest_count, buffet_price, started_at, session_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'ACTIVE')
        `, [sessionId, table_id, employee_id, queue_ticket_id || null, qrToken, count, price]);

        // Update table status to OCCUPIED
        await db.run('UPDATE DiningTable SET table_status = "OCCUPIED" WHERE table_id = ?', [table_id]);

        // If opened from a queue ticket, mark queue as SEATED
        if (queue_ticket_id) {
            await db.run('UPDATE QueueTicket SET queue_status = "SEATED" WHERE queue_ticket_id = ?', [queue_ticket_id]);
        }

        // Generate Tunnelmole QR Code
        const baseUrl = tunnel.getPublicUrl(req);
        const customerUrl = `${baseUrl}/qr/${qrToken}`;
        const qrImage = await QRCode.toDataURL(customerUrl, { width: 300, margin: 2 });

        // Emit socket events
        const io = req.app.get('socketio');
        if (io) {
            io.emit('table-status-changed', { table_id, table_status: 'OCCUPIED', session_id: sessionId });
            if (queue_ticket_id) {
                io.emit('queue-updated');
            }
        }

        res.json({
            success: true,
            message: `เปิดโต๊ะ ${table.table_no} เรียบร้อยแล้ว`,
            session_id: sessionId,
            qr_token: qrToken,
            table_no: table.table_no,
            guest_count: count,
            buffet_price: price,
            customer_url: customerUrl,
            qr_image: qrImage,
            started_at: new Date().toLocaleTimeString('th-TH')
        });
    } catch (err) {
        console.error('Error opening table:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเปิดโต๊ะ' });
    }
};

// Generate QR Code Data URL with Tunnelmole for print/display
exports.getQrCode = async (req, res) => {
    const { token } = req.params;
    try {
        const session = await db.get(`
            SELECT s.*, t.table_no 
            FROM DiningSession s
            JOIN DiningTable t ON s.table_id = t.table_id
            WHERE s.qr_token = ? AND s.session_status = 'ACTIVE'
        `, [token]);

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session หรือ QR Token ไม่ถูกต้อง' });
        }

        const baseUrl = tunnel.getPublicUrl(req);
        const customerUrl = `${baseUrl}/qr/${token}`;
        const qrImage = await QRCode.toDataURL(customerUrl, { width: 300, margin: 2 });

        res.json({
            success: true,
            table_no: session.table_no,
            session_id: session.session_id,
            guest_count: session.guest_count,
            buffet_price: session.buffet_price,
            started_at: session.started_at,
            customer_url: customerUrl,
            qr_image: qrImage
        });
    } catch (err) {
        console.error('Error generating QR:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้าง QR Code' });
    }
};

// View Bill summary for a session
exports.getBill = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await db.get(`
            SELECT s.*, t.table_no, e.full_name as opener_name
            FROM DiningSession s
            JOIN DiningTable t ON s.table_id = t.table_id
            LEFT JOIN Employee e ON s.opened_by = e.employee_id
            WHERE s.session_id = ?
        `, [sessionId]);

        if (!session) {
            return res.status(404).render('error', { message: 'ไม่พบข้อมูลการใช้บริการ' });
        }

        // Get ordered items
        const items = await db.query(`
            SELECT oi.*, mi.item_name, mi.charge_type
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE fo.session_id = ? AND oi.item_status != 'CANCELLED'
        `, [sessionId]);

        // Calculate Totals
        const buffetTotal = session.guest_count * session.buffet_price;
        let alacarteTotal = 0;

        items.forEach(item => {
            if (item.charge_type === 'ALACARTE') {
                alacarteTotal += item.quantity * item.unit_price_at_order;
            }
        });

        const subtotal = buffetTotal + alacarteTotal;
        const taxAmount = Math.round(subtotal * 0.07 * 100) / 100; // 7% VAT
        const netAmount = subtotal + taxAmount;

        res.render('cashier/bill', {
            session,
            items,
            buffetTotal,
            alacarteTotal,
            subtotal,
            taxAmount,
            netAmount,
            title: `ตรวจสอบบิล - โต๊ะ ${session.table_no}`
        });
    } catch (err) {
        console.error('Error fetching bill:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการคำนวณบิล' });
    }
};

// Process Payment & Close Session
exports.processPayment = async (req, res) => {
    const { session_id, payment_method, amount_received } = req.body;
    const employee_id = req.body.employee_id || 'EMP-001';

    try {
        const session = await db.get('SELECT * FROM DiningSession WHERE session_id = ? AND session_status = "ACTIVE"', [session_id]);
        if (!session) {
            return res.status(400).json({ success: false, message: 'Session นี้ถูกปิดไปแล้วหรือไม่มีอยู่จริง' });
        }

        // Get items and calculate final amount
        const items = await db.query(`
            SELECT oi.*, mi.charge_type
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE fo.session_id = ? AND oi.item_status != 'CANCELLED'
        `, [session_id]);

        const buffetTotal = session.guest_count * session.buffet_price;
        let alacarteTotal = 0;
        items.forEach(i => {
            if (i.charge_type === 'ALACARTE') {
                alacarteTotal += i.quantity * i.unit_price_at_order;
            }
        });

        const subtotal = buffetTotal + alacarteTotal;
        const taxAmount = Math.round(subtotal * 0.07 * 100) / 100;
        const netAmount = subtotal + taxAmount;

        const billId = 'BILL-' + Date.now();
        const receiptNo = 'RCP-' + Date.now();

        // 1. Insert Bill
        await db.run(`
            INSERT INTO Bill (bill_id, session_id, tax_amount, net_amount, bill_status, receipt_no)
            VALUES (?, ?, ?, ?, 'PAID', ?)
        `, [billId, session_id, taxAmount, netAmount, receiptNo]);

        // 2. Insert Payment
        const paymentId = 'PAY-' + Date.now();
        await db.run(`
            INSERT INTO Payment (payment_id, bill_id, received_by, payment_method, amount, payment_status)
            VALUES (?, ?, ?, ?, ?, 'SUCCESS')
        `, [paymentId, billId, employee_id, payment_method, netAmount]);

        // 3. Update Session to CLOSED
        await db.run('UPDATE DiningSession SET session_status = "CLOSED", ends_at = CURRENT_TIMESTAMP WHERE session_id = ?', [session_id]);

        // 4. Update Table to AVAILABLE
        await db.run('UPDATE DiningTable SET table_status = "AVAILABLE" WHERE table_id = ?', [session.table_id]);

        // Emit Socket event
        const io = req.app.get('socketio');
        if (io) {
            io.emit('table-status-changed', { table_id: session.table_id, table_status: 'AVAILABLE' });
            io.emit('session-closed', { session_id });
        }

        res.json({
            success: true,
            message: 'รับชำระเงินและปิดรอบบริการสำเร็จ',
            receipt_no: receiptNo,
            net_amount: netAmount
        });
    } catch (err) {
        console.error('Error processing payment:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการรับชำระเงิน' });
    }
};

// Reset table status manually
exports.resetTable = async (req, res) => {
    const { table_id } = req.body;
    try {
        await db.run('UPDATE DiningTable SET table_status = "AVAILABLE" WHERE table_id = ?', [table_id]);
        const io = req.app.get('socketio');
        if (io) {
            io.emit('table-status-changed', { table_id, table_status: 'AVAILABLE' });
        }
        res.json({ success: true, message: 'รีเซ็ตสถานะโต๊ะเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการรีเซ็ตโต๊ะ' });
    }
};
