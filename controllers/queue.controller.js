const db = require('../database/database');
const { randomUUID } = require('crypto');
const { fail, integer, today } = require('../utils/validation');
const cashier = require('./cashier.controller');

// อ่านบัตรคิวและนับคิวที่รออยู่ก่อนหน้า
function ticketData(id) {
  const ticket = db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [id]);
  if (!ticket) fail('ไม่พบบัตรคิว', 404);
  ticket.count_ahead = 0;
  if (ticket.queue_status === 'WAITING' || ticket.queue_status === 'CALLED') {
    const sql = `SELECT COUNT(*) n FROM QueueTicket
      WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
      AND CAST(SUBSTR(queue_no, 2) AS INTEGER) < ?`;
    const number = Number(ticket.queue_no.slice(1));
    ticket.count_ahead = db.get(sql, [ticket.queue_date, number]).n;
  }
  return ticket;
}

// ออกเลขคิวถัดไปของวันนี้และบันทึกจำนวนลูกค้า
function issueQueue(req, res) {
  const count = integer(req.body.guest_count, 50, 'จำนวนลูกค้า');
  const id = randomUUID();
  const date = today();
  const last = db.get(
    `SELECT MAX(CAST(SUBSTR(queue_no, 2) AS INTEGER)) n FROM QueueTicket
      WHERE queue_date = ?`,
    [date]
  );
  const number = 'Q' + String((last.n || 0) + 1).padStart(3, '0');
  const sql = `INSERT INTO QueueTicket (queue_ticket_id, queue_no, queue_date,
      guest_count) VALUES (?, ?, ?, ?)`;
  db.run(sql, [id, number, date, count]);
  res.json({ success: true, ticket: ticketData(id) });
}

// อ่านคิวรอหรือประวัติ แล้วส่งเป็น HTML หรือ JSON
function getQueues(req, res) {
  const day = today();
  const waitingSql = `SELECT * FROM QueueTicket
    WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
    ORDER BY CAST(SUBSTR(queue_no, 2) AS INTEGER)`;
  const waiting = db.query(waitingSql, [day]);
  let queues = waiting;
  if (req.query.history === '1') {
    const sql = `SELECT * FROM QueueTicket WHERE queue_date = ?
      ORDER BY CAST(SUBSTR(queue_no, 2) AS INTEGER)`;
    queues = db.query(sql, [req.query.date || day]);
  }
  const data = { queues, today: day, totalWaiting: waiting.length };
  const accept = req.get('accept') || '';
  if (accept.includes('text/html')) {
    res.render('cashier/partials/queue-list', data);
  } else {
    data.success = true;
    res.json(data);
  }
}

// เปลี่ยนสถานะได้เฉพาะคิววันนี้ที่ยังรอหรือถูกเรียก
function change(req, status) {
  const ticket = ticketData(req.body.queue_ticket_id);
  if (
    ticket.queue_date !== today() ||
    (ticket.queue_status !== 'WAITING' && ticket.queue_status !== 'CALLED')
  )
    fail('คิวนี้จบแล้ว', 409);
  db.run(`UPDATE QueueTicket SET queue_status = ? WHERE queue_ticket_id = ?`, [
    status,
    ticket.queue_ticket_id
  ]);
  return ticket;
}

// เรียกคิวหรือยกเลิกคิว แล้วส่งผลกลับให้หน้าจอ
function callQueue(req, res) {
  const ticket = change(req, 'CALLED');
  res.json({ success: true, queue_no: ticket.queue_no });
}

function cancelQueue(req, res) {
  change(req, 'CANCELLED');
  res.json({ success: true });
}

// อ่านบัตรคิวเดิมสำหรับเปิดดูหรือพิมพ์ซ้ำ
function getTicket(req, res) {
  res.json({ success: true, ticket: ticketData(req.params.id) });
}
// ส่งฟังก์ชันให้ routes; จัดโต๊ะจากคิวใช้ openTable ตัวเดียวกัน
module.exports = {
  issueQueue,
  getQueues,
  callQueue,
  cancelQueue,
  getTicket,
  seatQueue: cashier.openTable
};
