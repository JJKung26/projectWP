// ออกบัตรคิว เรียกคิว จัดโต๊ะ และพิมพ์บัตรเดิม
const db = require('../database/database');
const { randomUUID } = require('crypto');
const { check, id, integer, today } = require('../utils/validation');
const cashier = require('./cashier.controller');

// จำนวนคิวที่ยังรออยู่ก่อนบัตรนี้ ใช้ทั้งตอนออกบัตรและพิมพ์ซ้ำ
async function countAhead(ticket) {
  if (!['WAITING', 'CALLED'].includes(ticket.queue_status)) return 0;
  const row = await db.get(
    `SELECT COUNT(*) n FROM QueueTicket WHERE queue_date = ? AND queue_status IN ('WAITING','CALLED')
     AND CAST(SUBSTR(queue_no,2) AS INTEGER) < ?`,
    [ticket.queue_date, Number(ticket.queue_no.slice(1))]
  );
  return row.n;
}

// รับจำนวนลูกค้า สร้างเลขคิวของวันนี้ แล้วบันทึกบัตร
async function issueQueue(req, res) {
  const count = integer(req.body.guest_count, 50, 'จำนวนลูกค้า');
  const date = today();
  const ticket = await db.transaction(async (tx) => {
    const last = await tx.get(
      'SELECT MAX(CAST(SUBSTR(queue_no, 2) AS INTEGER)) seq FROM QueueTicket WHERE queue_date = ?',
      [date]
    );
    const seq = (last.seq || 0) + 1;
    const ticketId = randomUUID();
    const queueNo = 'Q' + String(seq).padStart(3, '0');
    await tx.run(
      `INSERT INTO QueueTicket(queue_ticket_id,queue_no,queue_date,guest_count,created_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)`,
      [ticketId, queueNo, date, count]
    );
    return tx.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [ticketId]);
  });
  const ahead = await countAhead(ticket);
  res.json({ success: true, ticket: { ...ticket, count_ahead: ahead } });
}

// อ่านคิวตามวันที่และตัวกรอง แล้วส่งรายการให้หน้าแคชเชียร์
async function getQueues(req, res) {
  const day = today();
  const date = req.query.date || day;
  const validDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  check(validDate && Number.isFinite(Date.parse(date)), 400, 'วันคิวไม่ถูกต้อง');
  check(new Date(date).toISOString().slice(0, 10) === date, 400, 'วันคิวไม่ถูกต้อง');
  const sql =
    'SELECT * FROM QueueTicket WHERE queue_date = ? ORDER BY CAST(SUBSTR(queue_no,2) AS INTEGER)';
  const tickets = await db.query(sql, [day]);
  const waiting = tickets.filter((ticket) => ['WAITING', 'CALLED'].includes(ticket.queue_status));
  let queues = waiting;
  if (req.query.history === '1') queues = tickets;
  if (req.query.history === '1' && date !== day) {
    queues = await db.query(sql, [date]);
  }
  const data = { queues, today: day, totalWaiting: waiting.length };
  if (req.get('accept')?.includes('text/html')) {
    return res.render('cashier/partials/queue-list', data);
  }
  res.json({ success: true, ...data });
}

// ตรวจบัตรคิวก่อนเปลี่ยนสถานะในฐานข้อมูล
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

// เปลี่ยนคิวเป็นเรียกแล้ว และส่งเลขคิวกลับให้เล่นเสียง
async function callQueue(req, res) {
  const ticket = await change(req, 'CALLED');
  res.json({ success: true, queue_no: ticket.queue_no });
}

// เปลี่ยนบัตรคิวเป็นยกเลิก
async function cancelQueue(req, res) {
  await change(req, 'CANCELLED');
  res.json({ success: true });
}
const seatQueue = cashier.openTable;

// อ่านบัตรเดิมพร้อมจำนวนคิวข้างหน้าเพื่อพิมพ์ซ้ำ
async function getTicket(req, res) {
  const ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
    req.params.id
  ]);
  check(ticket, 404, 'ไม่พบคิว');
  res.json({ success: true, ticket: { ...ticket, count_ahead: await countAhead(ticket) } });
}

module.exports = { issueQueue, getQueues, callQueue, cancelQueue, getTicket, seatQueue };
