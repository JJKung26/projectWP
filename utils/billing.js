const { money } = require('./validation');
const db = require('../database/database');

// ค่าบุฟเฟต์ + อาหารคิดเพิ่ม + VAT 7% แล้วปัดเศษลงเป็นบาท
function totals(session, items) {
  const adults = session.guest_count - session.child_count - session.free_child_count;
  let subtotal =
    adults * money(session.buffet_price) + session.child_count * money(session.child_price);
  for (const item of items) {
    if (item.charge_type === 'ALACARTE') {
      subtotal += item.quantity * money(item.unit_price_at_order);
    }
  }
  // คิด VAT ปัดยอดสุทธิลงเป็นบาท แล้วส่งยอดต่าง ๆ กลับ
  const taxCents = Math.round((subtotal * 7) / 100);
  const beforeRoundingCents = subtotal + taxCents;
  const netCents = Math.floor(beforeRoundingCents / 100) * 100;
  return {
    subtotal: subtotal / 100,
    taxAmount: taxCents / 100,
    beforeRounding: beforeRoundingCents / 100,
    roundingAmount: (netCents - beforeRoundingCents) / 100,
    netAmount: netCents / 100
  };
}

// อ่านอาหารของรอบบริการที่ยังไม่ถูกยกเลิก พร้อมราคาตอนสั่ง
function itemsFor(sessionId) {
  const sql = `SELECT orderItem.*, orderItem.item_name_at_order AS item_name,
    orderItem.charge_type_at_order AS charge_type
    FROM OrderItem orderItem
    JOIN FoodOrder foodOrder ON foodOrder.order_id = orderItem.order_id
    WHERE foodOrder.session_id = ? AND orderItem.item_status != 'CANCELLED'
    ORDER BY foodOrder.rowid, orderItem.rowid`;
  return db.query(sql, [sessionId]);
}
module.exports = { totals, itemsFor };
