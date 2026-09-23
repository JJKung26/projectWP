const db = require('../database/database');
const QRCode = require('qrcode');
const crypto = require('crypto');
const tunnel = require('../utils/tunnel');

// Format today's date YYYY-MM-DD
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// 1. Issue Queue Ticket
exports.issueQueue = async (req, res) => {
    const guest_count = parseInt(req.body.guest_count) || 2;
    const today = getTodayDateString();

    try {
        // Find highest queue_no for today
        const lastTicket = await db.get(
            `SELECT queue_no FROM QueueTicket WHERE queue_date = ? ORDER BY queue_ticket_id DESC LIMIT 1`,
            [today]
        );

        let nextSeq = 1;
        if (lastTicket && lastTicket.queue_no) {
            const numPart = parseInt(lastTicket.queue_no.replace(/\D/g, ''), 10);
            if (!isNaN(numPart)) {
                nextSeq = numPart + 1;
            }
        }

        const queueNo = 'Q' + String(nextSeq).padStart(3, '0');
        const queueTicketId = 'QT-' + Date.now();

        await db.run(`
            INSERT INTO QueueTicket (queue_ticket_id, queue_no, queue_date, guest_count, queue_status)
            VALUES (?, ?, ?, ?, 'WAITING')
        `, [queueTicketId, queueNo, today, guest_count]);

        // Count waiting tickets ahead
        const aheadResult = await db.get(`
            SELECT COUNT(*) as countAhead
            FROM QueueTicket
            WHERE queue_date = ? AND queue_status = 'WAITING' AND queue_ticket_id < ?
        `, [today, queueTicketId]);

        const countAhead = aheadResult ? aheadResult.countAhead : 0;

        // Emit Socket.IO event
        const io = req.app.get('socketio');
        if (io) {
            io.emit('queue-updated', { queueNo, queueTicketId, guest_count });
        }

        res.json({
            success: true,
            message: `ออกบัตรคิว ${queueNo} สำเร็จ`,
            ticket: {
                queue_ticket_id: queueTicketId,
                queue_no: queueNo,
                guest_count,
                queue_date: today,
                count_ahead: countAhead,
                created_at: new Date().toLocaleTimeString('th-TH')
            }
        });
    } catch (err) {
        console.error('Error issuing queue ticket:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการออกบัตรคิว' });
    }
};

// 2. Get Waiting & Called Queues
exports.getQueues = async (req, res) => {
    const today = getTodayDateString();
    try {
        const queues = await db.query(`
            SELECT * FROM QueueTicket
            WHERE queue_date = ? AND queue_status IN ('WAITING', 'CALLED')
            ORDER BY queue_ticket_id ASC
        `, [today]);

        const totalWaiting = queues.filter(q => q.queue_status === 'WAITING').length;

        res.json({
            success: true,
            queues,
            totalWaiting
        });
    } catch (err) {
        console.error('Error fetching queues:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงรายการคิว' });
    }
};

// 3. Call Queue Ticket
exports.callQueue = async (req, res) => {
    const { queue_ticket_id } = req.body;
    try {
        const ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [queue_ticket_id]);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'ไม่พบบัตรคิว' });
        }

        await db.run(`UPDATE QueueTicket SET queue_status = 'CALLED' WHERE queue_ticket_id = ?`, [queue_ticket_id]);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('queue-called', {
                queue_ticket_id,
                queue_no: ticket.queue_no,
                guest_count: ticket.guest_count
            });
            io.emit('queue-updated');
        }

        res.json({ success: true, message: `เรียกคิว ${ticket.queue_no} แล้ว`, queue_no: ticket.queue_no });
    } catch (err) {
        console.error('Error calling queue:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเรียกคิว' });
    }
};

// 4. Seat Queue to Table
exports.seatQueue = async (req, res) => {
    const { queue_ticket_id, table_id, buffet_price } = req.body;
    const employee_id = req.body.employee_id || 'EMP-001';

    try {
        const ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [queue_ticket_id]);
        if (!ticket || ticket.queue_status === 'SEATED' || ticket.queue_status === 'CANCELLED') {
            return res.status(400).json({ success: false, message: 'บัตรคิวนี้ใช้งานไม่ได้หรือถูกยกเลิกแล้ว' });
        }

        const table = await db.get('SELECT * FROM DiningTable WHERE table_id = ?', [table_id]);
        if (!table) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลโต๊ะ' });
        }
        if (table.table_status === 'OCCUPIED') {
            return res.status(400).json({ success: false, message: 'โต๊ะนี้มีผู้ใช้งานอยู่แล้ว' });
        }

        const sessionId = 'SES-' + Date.now();
        const qrToken = 'QR-' + table.table_no + '-' + crypto.randomBytes(4).toString('hex');
        const price = parseFloat(buffet_price) || 279.0;
        const count = ticket.guest_count || 2;

        // Create DiningSession linked with queue_ticket_id
        await db.run(`
            INSERT INTO DiningSession (session_id, table_id, opened_by, queue_ticket_id, qr_token, guest_count, buffet_price, started_at, session_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'ACTIVE')
        `, [sessionId, table_id, employee_id, queue_ticket_id, qrToken, count, price]);

        // Update Table Status to OCCUPIED
        await db.run('UPDATE DiningTable SET table_status = "OCCUPIED" WHERE table_id = ?', [table_id]);

        // Update QueueTicket to SEATED
        await db.run('UPDATE QueueTicket SET queue_status = "SEATED" WHERE queue_ticket_id = ?', [queue_ticket_id]);

        // Generate Tunnelmole QR Code
        const baseUrl = tunnel.getPublicUrl(req);
        const customerUrl = `${baseUrl}/qr/${qrToken}`;
        const qrImage = await QRCode.toDataURL(customerUrl, { width: 300, margin: 2 });

        const io = req.app.get('socketio');
        if (io) {
            io.emit('table-status-changed', { table_id, table_status: 'OCCUPIED', session_id: sessionId });
            io.emit('queue-updated');
        }

        res.json({
            success: true,
            message: `จัดคิว ${ticket.queue_no} เข้าโต๊ะ ${table.table_no} เรียบร้อยแล้ว`,
            session_id: sessionId,
            qr_token: qrToken,
            table_no: table.table_no,
            guest_count: count,
            buffet_price: price,
            queue_no: ticket.queue_no,
            customer_url: customerUrl,
            qr_image: qrImage,
            started_at: new Date().toLocaleTimeString('th-TH')
        });
    } catch (err) {
        console.error('Error seating queue:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการจัดคิวเข้าโต๊ะ' });
    }
};

// 5. Cancel Queue
exports.cancelQueue = async (req, res) => {
    const { queue_ticket_id } = req.body;
    try {
        await db.run(`UPDATE QueueTicket SET queue_status = 'CANCELLED' WHERE queue_ticket_id = ?`, [queue_ticket_id]);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('queue-updated');
        }

        res.json({ success: true, message: 'ยกเลิกคิวเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error cancelling queue:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกคิว' });
    }
};
