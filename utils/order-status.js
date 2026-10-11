const db = require('../database/database');
const { check, id } = require('./validation');
const emit = require('./events');
module.exports = async function changeItems(req, res, serving = false) {
    const { order_id, order_item_id, cancel_reason, out_of_stock } = req.body;
    const status = serving ? 'SERVED' : req.body.status;
    check(serving || ['COOKING', 'READY', 'CANCELLED'].includes(status), 400, 'สถานะไม่ถูกต้อง');
    check(
        Boolean(order_id) !== Boolean(order_item_id),
        400,
        'ระบุออเดอร์หรือรายการอาหารเพียงอย่างเดียว'
    );
    id(order_id || order_item_id, 'รหัสอาหาร');
    const result = await db.transaction(async () => {
        const items = await db.query(
            `SELECT oi.*, fo.session_id, ds.session_status FROM OrderItem oi
            JOIN FoodOrder fo ON fo.order_id = oi.order_id JOIN DiningSession ds ON ds.session_id = fo.session_id
            WHERE ${order_id ? 'oi.order_id' : 'oi.order_item_id'} = ?`,
            [order_id || order_item_id]
        );
        check(items.length, 404, 'ไม่พบออเดอร์หรือรายการอาหาร');
        check(items[0].session_status === 'ACTIVE', 409, 'รอบบริการปิดแล้ว');
        const allowed = {
            COOKING: ['PENDING'],
            READY: ['COOKING'],
            CANCELLED: ['PENDING', 'COOKING', 'READY'],
            SERVED: ['READY']
        }[status];
        const targets = items.filter(i => allowed.includes(i.item_status));
        check(targets.length, 409, 'สถานะอาหารเปลี่ยนแล้ว กรุณาดึงข้อมูลล่าสุด');
        for (const item of targets) {
            await db.run(
                `UPDATE OrderItem SET item_status = ?, ${serving ? 'served_by' : 'prepared_by'} = ?, cancel_reason = ? WHERE order_item_id = ?`,
                [
                    status,
                    req.staff.employee_id,
                    status === 'CANCELLED' ? cancel_reason || 'ยกเลิกรายการ' : null,
                    item.order_item_id
                ]
            );
        }
        const stockIds = [];
        if (status === 'CANCELLED' && out_of_stock === true) {
            for (const id of new Set(targets.map(i => i.menu_item_id))) {
                await db.run('UPDATE MenuItem SET availability = 0 WHERE menu_item_id = ?', [id]);
                stockIds.push(id);
            }
        }
        return { session_id: items[0].session_id, order_id: items[0].order_id, stockIds };
    });
    result.stockIds.forEach(menu_item_id =>
        emit(req, 'stock-updated', { menu_item_id, availability: 0 })
    );
    emit(req, 'order-status-changed', {
        session_id: result.session_id,
        order_id: result.order_id,
        order_item_id,
        status
    });
    res.json({ success: true });
};
