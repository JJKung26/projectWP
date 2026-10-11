const db = require('../database/database');
const { randomUUID } = require('crypto');
const { check, id, integer, today } = require('../utils/validation');
const emit = require('../utils/events');
const cashier = require('./cashier.controller');

exports.issueQueue = async (req, res) => {
    const count = integer(req.body.guest_count, 50, 'จำนวนลูกค้า');
    const date = today();
    const ticket = await db.transaction(async () => {
        const last = await db.get(
            'SELECT MAX(CAST(SUBSTR(queue_no, 2) AS INTEGER)) seq FROM QueueTicket WHERE queue_date = ?',
            [date]
        );
        const seq = (last.seq || 0) + 1;
        const id = randomUUID(),
            no = 'Q' + String(seq).padStart(3, '0');
        await db.run(
            `INSERT INTO QueueTicket(queue_ticket_id,queue_no,queue_date,guest_count,created_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)`,
            [id, no, date, count]
        );
        return db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [id]);
    });
    const ahead = await db.get(
        `SELECT COUNT(*) n FROM QueueTicket WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
        AND CAST(SUBSTR(queue_no,2) AS INTEGER) < ?`,
        [date, Number(ticket.queue_no.slice(1))]
    );
    emit(req, 'queue-updated');
    res.json({ success: true, ticket: { ...ticket, count_ahead: ahead.n } });
};
exports.getQueues = async (req, res) => {
    const date = req.query.date || today();
    check(
        typeof date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            Number.isFinite(Date.parse(date)) &&
            new Date(date).toISOString().slice(0, 10) === date,
        400,
        'วันคิวไม่ถูกต้อง'
    );
    const history = req.query.history === '1';
    const queues = await db.query(
        `SELECT * FROM QueueTicket WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
        ORDER BY CAST(SUBSTR(queue_no,2) AS INTEGER)`,
        [today()]
    );
    const tickets = history
        ? await db.query(
              `SELECT * FROM QueueTicket WHERE queue_date = ?
        ORDER BY CAST(SUBSTR(queue_no,2) AS INTEGER)`,
              [date]
          )
        : queues;
    res.json({ success: true, queues: tickets, today: today(), totalWaiting: queues.length });
};
async function change(req, status) {
    id(req.body.queue_ticket_id, 'รหัสคิว');
    return db.transaction(async () => {
        const ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
            req.body.queue_ticket_id
        ]);
        check(ticket, 404, 'ไม่พบคิว');
        check(
            ticket.queue_date === today() && ['WAITING', 'CALLED'].includes(ticket.queue_status),
            409,
            'สถานะคิวนี้เปลี่ยนไม่ได้แล้ว'
        );
        await db.run('UPDATE QueueTicket SET queue_status = ? WHERE queue_ticket_id = ?', [
            status,
            ticket.queue_ticket_id
        ]);
        return ticket;
    });
}
exports.callQueue = async (req, res) => {
    const ticket = await change(req, 'CALLED');
    emit(req, 'queue-called', ticket);
    emit(req, 'queue-updated');
    res.json({ success: true, queue_no: ticket.queue_no });
};
exports.cancelQueue = async (req, res) => {
    await change(req, 'CANCELLED');
    emit(req, 'queue-updated');
    res.json({ success: true });
};
exports.seatQueue = cashier.openTable;
exports.getTicket = async (req, res) => {
    const ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
        req.params.id
    ]);
    check(ticket, 404, 'ไม่พบคิว');
    const ahead = await db.get(
        `SELECT COUNT(*) n FROM QueueTicket WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
        AND CAST(SUBSTR(queue_no,2) AS INTEGER) < ?`,
        [ticket.queue_date, Number(ticket.queue_no.slice(1))]
    );
    res.json({
        success: true,
        ticket: {
            ...ticket,
            count_ahead: ['WAITING', 'CALLED'].includes(ticket.queue_status) ? ahead.n : 0
        }
    });
};
