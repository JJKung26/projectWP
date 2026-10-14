const db = require('../database/database');
const { randomUUID } = require('crypto');
const { fail, integer, money, today } = require('./validation');

// บันทึกสถานะโต๊ะว่างหรือมีลูกค้า
function setTableStatus(tableId, status) {
  db.run(`UPDATE DiningTable SET table_status = ? WHERE table_id = ?`, [status, tableId]);
}

// เปิดรอบบริการและสร้าง token สำหรับ QR ของโต๊ะ
function openSession(body, employeeId) {
  return db.transaction(function () {
    // 1. ตรวจโต๊ะ จำนวนลูกค้า และราคา
    const table = db.get('SELECT * FROM DiningTable WHERE table_id = ?', [body.table_id]);
    if (!table || table.table_status !== 'AVAILABLE') fail('โต๊ะนี้ไม่ว่าง', 409);
    const adults = integer(body.adult_count, table.capacity, 'จำนวนผู้ใหญ่', 0);
    const children = integer(body.child_count, table.capacity, 'จำนวนเด็ก', 0);
    const freeChildren = integer(body.free_child_count, table.capacity, 'จำนวนเด็กทานฟรี', 0);
    const count = integer(adults + children + freeChildren, table.capacity, 'จำนวนลูกค้ารวม');
    const price = money(body.buffet_price) / 100;
    const childPrice = money(body.child_price) / 100;
    if (price <= 0 || childPrice <= 0) fail('ราคาบุฟเฟต์ต้องมากกว่า 0');

    // 2. ถ้ามาจากคิว ตรวจว่าคิวยังรออยู่และจำนวนคนตรงกัน
    let ticketId = null;
    if (body.queue_ticket_id) {
      const ticket = db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
        body.queue_ticket_id
      ]);
      if (
        !ticket ||
        ticket.queue_date !== today() ||
        (ticket.queue_status !== 'WAITING' && ticket.queue_status !== 'CALLED')
      )
        fail('คิวนี้จัดโต๊ะไม่ได้แล้ว', 409);
      if (ticket.guest_count !== count) fail('จำนวนลูกค้าต้องตรงกับบัตรคิว');
      ticketId = ticket.queue_ticket_id;
    }

    // 3. บันทึกรอบบริการและเปลี่ยนโต๊ะเป็นมีลูกค้า
    const sessionId = randomUUID();
    const token = randomUUID();
    const sql = `INSERT INTO DiningSession
      (session_id, table_id, opened_by, queue_ticket_id, qr_token,
       guest_count, child_count, free_child_count, buffet_price, child_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
      sessionId, table.table_id, employeeId, ticketId, token,
      count, children, freeChildren, price, childPrice
    ]);
    setTableStatus(table.table_id, 'OCCUPIED');
    if (ticketId) {
      db.run(
        `UPDATE QueueTicket SET queue_status = 'SEATED'
          WHERE queue_ticket_id = ?`,
        [ticketId]
      );
    }
    const session = db.get('SELECT * FROM DiningSession WHERE session_id = ?', [sessionId]);
    session.table_no = table.table_no;
    return session;
  });
}
module.exports = { openSession, setTableStatus };
