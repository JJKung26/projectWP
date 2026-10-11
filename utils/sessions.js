const db = require('../database/database');
const { randomUUID } = require('crypto');
const { check, id, integer, money, today } = require('./validation');
async function openSession(body, employeeId) {
    id(body.table_id, 'รหัสโต๊ะ');
    if (body.queue_ticket_id) id(body.queue_ticket_id, 'รหัสคิว');
    return db.transaction(async () => {
        const table = await db.get('SELECT * FROM DiningTable WHERE table_id = ?', [body.table_id]);
        check(table, 404, 'ไม่พบโต๊ะ');
        check(table.table_status === 'AVAILABLE', 409, 'เปิดได้เฉพาะโต๊ะว่าง');
        let ticket;
        if (body.queue_ticket_id) {
            ticket = await db.get('SELECT * FROM QueueTicket WHERE queue_ticket_id = ?', [
                body.queue_ticket_id
            ]);
            check(ticket, 404, 'ไม่พบคิว');
            check(
                ['WAITING', 'CALLED'].includes(ticket.queue_status) &&
                    ticket.queue_date === today(),
                409,
                'คิวนี้ไม่สามารถจัดโต๊ะได้'
            );
        }
        const children = integer(
            body.child_count === undefined ? 0 : body.child_count,
            table.capacity,
            'จำนวนเด็ก',
            0
        );
        const freeChildren = integer(
            body.free_child_count === undefined ? 0 : body.free_child_count,
            table.capacity,
            'จำนวนเด็กทานฟรี',
            0
        );
        const count =
            body.adult_count === undefined
                ? integer(
                      ticket ? ticket.guest_count : body.guest_count,
                      table.capacity,
                      'จำนวนลูกค้า'
                  )
                : integer(
                      integer(body.adult_count, table.capacity, 'จำนวนผู้ใหญ่', 0) +
                          children +
                          freeChildren,
                      table.capacity,
                      'จำนวนลูกค้ารวม'
                  );
        check(children + freeChildren <= count, 400, 'จำนวนเด็กต้องไม่เกินจำนวนลูกค้ารวม');
        check(!ticket || count === ticket.guest_count, 400, 'จำนวนลูกค้ารวมต้องตรงกับบัตรคิว');
        const price = money(body.buffet_price, 10000) / 100;
        check(price > 0, 400, 'ราคาแพ็กเกจต้องมากกว่า 0');
        const childPrice =
            money(body.child_price === undefined ? 179 : body.child_price, 10000) / 100;
        check(childPrice > 0, 400, 'ราคาเด็กต้องมากกว่า 0');
        const sessionId = randomUUID(),
            token = randomUUID();
        await db.run(
            `INSERT INTO DiningSession(session_id, table_id, opened_by, queue_ticket_id, qr_token, guest_count, buffet_price, child_count, free_child_count, child_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sessionId,
                table.table_id,
                employeeId,
                ticket?.queue_ticket_id || null,
                token,
                count,
                price,
                children,
                freeChildren,
                childPrice
            ]
        );
        await db.run("UPDATE DiningTable SET table_status = 'OCCUPIED' WHERE table_id = ?", [
            table.table_id
        ]);
        if (ticket)
            await db.run(
                "UPDATE QueueTicket SET queue_status = 'SEATED' WHERE queue_ticket_id = ?",
                [ticket.queue_ticket_id]
            );
        return {
            ...(await db.get('SELECT * FROM DiningSession WHERE session_id = ?', [sessionId])),
            table_no: table.table_no,
            queue_no: ticket?.queue_no
        };
    });
}
module.exports = { openSession };
