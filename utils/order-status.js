const db = require('../database/database');
const { fail } = require('./validation');

// แต่ละสถานะเปลี่ยนมาจากสถานะใดได้บ้าง
const previous = {
  COOKING: ['PENDING'],
  READY: ['COOKING'],
  SERVED: ['READY'],
  CANCELLED: ['PENDING', 'COOKING', 'READY']
};

// เลือกสถานะใหม่และอ่านอาหารที่ต้องเปลี่ยน
function changeItems(req, res, serving = false) {
  const body = req.body;
  const status = serving ? 'SERVED' : body.status;
  if (!['COOKING', 'READY', 'SERVED', 'CANCELLED'].includes(status)) fail('สถานะอาหารไม่ถูกต้อง');
  const sql = `SELECT oi.* FROM OrderItem oi
    JOIN FoodOrder fo ON fo.order_id = oi.order_id
    JOIN DiningSession s ON s.session_id = fo.session_id
    WHERE s.session_status = 'ACTIVE' AND (oi.order_id = ? OR oi.order_item_id = ?)`;
  // เลือกว่าจะบันทึกพนักงานครัวหรือพนักงานเสิร์ฟ
  const worker = serving ? 'served_by' : 'prepared_by';
  const update = `UPDATE OrderItem
    SET item_status = ?, ${worker} = ?, cancel_reason = ?
    WHERE order_item_id = ?`;

  // เปลี่ยนรายการที่ทำได้ และปิดสต็อกเมื่อยกเลิกเพราะของหมด
  db.transaction(function () {
    const items = db.query(sql, [body.order_id || '', body.order_item_id || '']);
    let changed = 0;
    for (const item of items) {
      if (!previous[status].includes(item.item_status)) continue;
      const reason = status === 'CANCELLED' ? body.cancel_reason || 'ยกเลิกรายการ' : null;
      db.run(update, [status, req.staff.employee_id, reason, item.order_item_id]);
      if (status === 'CANCELLED' && body.out_of_stock) {
        db.run(`UPDATE MenuItem SET availability = 0 WHERE menu_item_id = ?`, [item.menu_item_id]);
      }
      changed++;
    }
    if (!changed) fail('ไม่มีอาหารที่เปลี่ยนสถานะได้ กรุณาโหลดข้อมูลใหม่', 409);
  });
  res.json({ success: true });
}
module.exports = changeItems;
