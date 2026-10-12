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
  const result = await db.transaction(async (tx) => {
    const items = await tx.query(
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
    const targets = items.filter((i) => allowed.includes(i.item_status));
    check(targets.length, 409, 'สถานะอาหารเปลี่ยนแล้ว กรุณาดึงข้อมูลล่าสุด');
    const employeeColumn = serving ? 'served_by' : 'prepared_by';
    const reason = status === 'CANCELLED' ? cancel_reason || 'ยกเลิกรายการ' : null;
    const stockIds = [];
    for (const item of targets) {
      await tx.run(
        `UPDATE OrderItem SET item_status = ?, ${employeeColumn} = ?, cancel_reason = ? WHERE order_item_id = ?`,
        [status, req.staff.employee_id, reason, item.order_item_id]
      );
      // อัปเดตสต็อกในลูปเดียวกัน แต่แต่ละเมนูทำเพียงครั้งเดียว
      if (
        status === 'CANCELLED' &&
        out_of_stock === true &&
        !stockIds.includes(item.menu_item_id)
      ) {
        await tx.run('UPDATE MenuItem SET availability = 0 WHERE menu_item_id = ?', [
          item.menu_item_id
        ]);
        stockIds.push(item.menu_item_id);
      }
    }
    return { session_id: items[0].session_id, order_id: items[0].order_id, stockIds };
  });
  result.stockIds.forEach((menu_item_id) =>
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
