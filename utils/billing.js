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
  const tax = Math.round((subtotal * 7) / 100);
  const before = subtotal + tax;
  const net = Math.floor(before / 100) * 100;
  return {
    subtotal: subtotal / 100,
    taxAmount: tax / 100,
    beforeRounding: before / 100,
    roundingAmount: (net - before) / 100,
    netAmount: net / 100
  };
}

// อ่านอาหารของรอบบริการที่ยังไม่ถูกยกเลิก พร้อมราคาตอนสั่ง
function itemsFor(sessionId) {
  const sql = `SELECT oi.*, oi.item_name_at_order AS item_name,
    oi.charge_type_at_order AS charge_type
    FROM OrderItem oi
    JOIN FoodOrder fo ON fo.order_id = oi.order_id
    WHERE fo.session_id = ? AND oi.item_status != 'CANCELLED'
    ORDER BY fo.rowid, oi.rowid`;
  return db.query(sql, [sessionId]);
}
module.exports = { totals, itemsFor };
