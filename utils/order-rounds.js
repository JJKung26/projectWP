const db = require('../database/database');

// อ่านอาหารตามสถานะ พร้อมข้อมูลโต๊ะของรอบที่ยังเปิดอยู่
function activeOrderItems(first, second = first) {
  const sql = `SELECT orderItem.*, menuItem.item_name, menuItem.image_url,
    diningTable.table_no, foodOrder.session_id, foodOrder.ordered_at
    FROM OrderItem orderItem
    JOIN FoodOrder foodOrder ON orderItem.order_id = foodOrder.order_id
    JOIN DiningSession diningSession ON foodOrder.session_id = diningSession.session_id
    JOIN DiningTable diningTable ON diningSession.table_id = diningTable.table_id
    JOIN MenuItem menuItem ON orderItem.menu_item_id = menuItem.menu_item_id
    WHERE orderItem.item_status IN (?, ?) AND diningSession.session_status = 'ACTIVE'
    ORDER BY foodOrder.rowid, orderItem.rowid`;
  return db.query(sql, [first, second]);
}

// รวมอาหารตามรหัสออเดอร์ พร้อมนับจำนวนและสถานะในลูปเดียว
function groupOrderItems(items) {
  const rounds = {};
  for (const item of items) {
    const orderId = item.order_id;
    if (!rounds[orderId]) {
      rounds[orderId] = {
        order_id: orderId,
        table_no: item.table_no,
        session_id: item.session_id,
        ordered_at: item.ordered_at,
        round_no: item.round_no,
        items: [],
        quantity: 0,
        counts: { PENDING: 0, COOKING: 0, READY: 0, SERVED: 0, CANCELLED: 0 }
      };
    }
    const round = rounds[orderId];
    round.items.push(item);
    round.quantity += item.quantity;
    round.counts[item.item_status] += item.quantity;
  }
  // สรุปสถานะทั้งรอบจากสถานะอาหารแต่ละรายการ
  for (const orderId in rounds) {
    const round = rounds[orderId];
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
