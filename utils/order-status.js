// เปลี่ยนสถานะอาหารให้ครัวและจุดเสิร์ฟใช้ร่วมกัน
const db = require('../database/database');
const { check, id } = require('./validation');

// ตรวจสถานะเดิม แล้วบันทึกสถานะใหม่พร้อมชื่อพนักงาน
module.exports = async function changeItems(req, res, serving = false) {
  const { order_id, order_item_id, cancel_reason, out_of_stock } = req.body;
  let status = req.body.status;
  let employeeColumn = 'prepared_by';
  let filter = 'oi.order_item_id';
  if (serving) {
    status = 'SERVED';
    employeeColumn = 'served_by';
  }
  if (order_id) filter = 'oi.order_id';
  check(serving || ['COOKING', 'READY', 'CANCELLED'].includes(status), 400, 'สถานะไม่ถูกต้อง');
  const oneId = Boolean(order_id) !== Boolean(order_item_id);
  check(oneId, 400, 'ระบุออเดอร์หรือรายการอาหารเพียงอย่างเดียว');
  id(order_id || order_item_id, 'รหัสอาหาร');
  await db.transaction(async (tx) => {
    const items = await tx.query(
      `SELECT oi.*, fo.session_id, ds.session_status FROM OrderItem oi
            JOIN FoodOrder fo ON fo.order_id = oi.order_id JOIN DiningSession ds ON ds.session_id = fo.session_id
            WHERE ${filter} = ?`,
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
    let reason = null;
    if (status === 'CANCELLED') reason = cancel_reason || 'ยกเลิกรายการ';
    const soldOut = status === 'CANCELLED' && out_of_stock === true;
    let changed = 0;
    for (const item of items) {
      if (!allowed.includes(item.item_status)) continue;
      await tx.run(
        `UPDATE OrderItem SET item_status = ?, ${employeeColumn} = ?, cancel_reason = ? WHERE order_item_id = ?`,
        [status, req.staff.employee_id, reason, item.order_item_id]
      );
      changed++;
      // เมนูที่หมดแล้วไม่ต้องอัปเดตซ้ำ
      if (soldOut) {
        await tx.run(
          'UPDATE MenuItem SET availability = 0 WHERE menu_item_id = ? AND availability = 1',
          [item.menu_item_id]
        );
      }
    }
    check(changed > 0, 409, 'สถานะอาหารเปลี่ยนแล้ว กรุณาดึงข้อมูลล่าสุด');
  });
  res.json({ success: true });
};
