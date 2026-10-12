const db = require('../database/database');
const { randomUUID } = require('crypto');
const { check, id, integer, today } = require('../utils/validation');
const emit = require('../utils/events');
const cashier = require('./cashier.controller');

// จำนวนคิวที่ยังรออยู่ก่อนบัตรนี้ ใช้ทั้งตอนออกบัตรและพิมพ์ซ้ำ
async function countAhead(ticket) {
  if (!['WAITING', 'CALLED'].includes(ticket.queue_status)) {
    return 0;
  }
  const row = await db.get(
    `SELECT COUNT(*) n FROM QueueTicket WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
     AND CAST(SUBSTR(queue_no,2) AS INTEGER) < ?`,
    [ticket.queue_date, Number(ticket.queue_no.slice(1))]
  );
  return row.n;
}

exports.issueQueue = async function (req, res) {
  const count = integer(req.body.guest_count, 50, 'จำนวนลูกค้า');
  const date = today();
  const ticket = await db.transaction(async (tx) => {
    const last = await tx.get(
      'SELECT MAX(CAST(SUBSTR(queue_no, 2) AS INTEGER)) seq FROM QueueTicket WHERE queue_date = ?',
      [date]
    );
    const seq = (last.seq || 0) + 1;
    const id = randomUUID(),
      no = 'Q' + String(seq).padStart(3, '0');
    await tx.run(
      `INSERT INTO QueueTicket(queue_ticket_id,queue_no,queue_date,guest_count,created_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)`,
      [id, no, date, count]
    );
    return tx.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [id]);
  });
  const ahead = await countAhead(ticket);
  emit(req, 'queue-updated');
  res.json({ success: true, ticket: { ...ticket, count_ahead: ahead } });
};

exports.getQueues = async function (req, res) {
  const day = today();
  const date = req.query.date || day;
  check(
    typeof date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date,
    400,
    'วันคิวไม่ถูกต้อง'
  );
  const sql =
    'SELECT * FROM QueueTicket WHERE queue_date = ? ORDER BY CAST(SUBSTR(queue_no,2) AS INTEGER)';
  const tickets = await db.query(sql, [day]);
  const waiting = tickets.filter((ticket) => ['WAITING', 'CALLED'].includes(ticket.queue_status));
  let queues = waiting;
  if (req.query.history === '1') {
    queues = tickets;
    if (date !== day) {
      queues = await db.query(sql, [date]);
    }
  }
  res.json({ success: true, queues, today: day, totalWaiting: waiting.length });
};

async function change(req, status) {
  id(req.body.queue_ticket_id, 'รหัสคิว');
  return db.transaction(async (tx) => {
    const ticket = await tx.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
      req.body.queue_ticket_id
    ]);
    check(ticket, 404, 'ไม่พบคิว');
    check(
      ticket.queue_date === today() && ['WAITING', 'CALLED'].includes(ticket.queue_status),
      409,
      'สถานะคิวนี้เปลี่ยนไม่ได้แล้ว'
    );
    await tx.run('UPDATE QueueTicket SET queue_status = ? WHERE queue_ticket_id = ?', [
      status,
      ticket.queue_ticket_id
    ]);
    return ticket;
  });
}

exports.callQueue = async function (req, res) {
  const ticket = await change(req, 'CALLED');
  emit(req, 'queue-called', ticket);
  emit(req, 'queue-updated');
  res.json({ success: true, queue_no: ticket.queue_no });
};

exports.cancelQueue = async function (req, res) {
  await change(req, 'CANCELLED');
  emit(req, 'queue-updated');
  res.json({ success: true });
};
exports.seatQueue = cashier.openTable;

exports.getTicket = async function (req, res) {
  const ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
    req.params.id
  ]);
  check(ticket, 404, 'ไม่พบคิว');
  res.json({ success: true, ticket: { ...ticket, count_ahead: await countAhead(ticket) } });
};
