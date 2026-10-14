const db = require('../database/database');

// อ่านอาหารตามสถานะ พร้อมข้อมูลโต๊ะของรอบที่ยังเปิดอยู่
function activeOrderItems(first, second = first) {
  const sql = `SELECT oi.*, mi.item_name, mi.image_url,
    t.table_no, fo.session_id, fo.ordered_at
    FROM OrderItem oi
    JOIN FoodOrder fo ON oi.order_id = fo.order_id
    JOIN DiningSession s ON fo.session_id = s.session_id
    JOIN DiningTable t ON s.table_id = t.table_id
    JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
    WHERE oi.item_status IN (?, ?) AND s.session_status = 'ACTIVE'
    ORDER BY fo.rowid, oi.rowid`;
  return db.query(sql, [first, second]);
}

// รวมอาหารตามรหัสออเดอร์ พร้อมนับจำนวนและสถานะในลูปเดียว
function groupOrderItems(items) {
  const rounds = {};
  for (const item of items) {
    const id = item.order_id;
    if (!rounds[id]) {
      rounds[id] = {
        order_id: id,
        table_no: item.table_no,
        session_id: item.session_id,
        ordered_at: item.ordered_at,
        round_no: item.round_no,
        items: [],
        quantity: 0,
        counts: { PENDING: 0, COOKING: 0, READY: 0, SERVED: 0, CANCELLED: 0 }
      };
    }
    const round = rounds[id];
    round.items.push(item);
    round.quantity += item.quantity;
    round.counts[item.item_status] += item.quantity;
  }
  // สรุปสถานะทั้งรอบจากสถานะอาหารแต่ละรายการ
  for (const id in rounds) {
    const round = rounds[id];
    const count = round.counts;
    round.status = 'PENDING';
    if (count.CANCELLED === round.quantity) round.status = 'CANCELLED';
    else if (count.SERVED + count.CANCELLED === round.quantity) round.status = 'SERVED';
    else if (count.READY) round.status = 'READY';
    else if (count.COOKING) round.status = 'COOKING';
  }
  return Object.values(rounds);
}
module.exports = { activeOrderItems, groupOrderItems };
