const db = require('../database/database');

function activeOrderItems(statuses) {
  const placeholders = statuses.map(() => '?').join(', ');
  return db.query(
    `SELECT oi.*, mi.item_name, mi.image_url, t.table_no, fo.session_id, fo.ordered_at
     FROM OrderItem oi JOIN FoodOrder fo ON oi.order_id = fo.order_id
     JOIN DiningSession ds ON fo.session_id = ds.session_id
     JOIN DiningTable t ON ds.table_id = t.table_id
     JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
     WHERE oi.item_status IN (${placeholders}) AND ds.session_status = 'ACTIVE'
     ORDER BY fo.rowid ASC, oi.rowid ASC`,
    statuses
  );
}

// รวมรายการที่มี order_id เดียวกัน โดยเก็บลำดับเดิม
function groupOrderItems(items) {
  const rounds = [];
  for (const item of items) {
    const { order_id, table_no, session_id, ordered_at } = item;
    let round = rounds.find((round) => round.order_id === order_id);
    if (!round) {
      round = {
        order_id,
        table_no,
        session_id,
        ordered_at,
        items: [],
        pending_count: 0,
        cooking_count: 0
      };
      rounds.push(round);
    }
    round.items.push(item);
    if (item.item_status === 'PENDING') {
      round.pending_count++;
    }
    if (item.item_status === 'COOKING') {
      round.cooking_count++;
    }
  }
  return rounds;
}
module.exports = { activeOrderItems, groupOrderItems };
