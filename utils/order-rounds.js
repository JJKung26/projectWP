const db = require('../database/database');

function activeOrderItems(statuses) {
    const placeholders = statuses.map(() => '?').join(', ');
    return db.query(
        `
        SELECT oi.*, mi.item_name, mi.image_url, t.table_no, fo.session_id, fo.ordered_at
        FROM OrderItem oi
        JOIN FoodOrder fo ON oi.order_id = fo.order_id
        JOIN DiningSession ds ON fo.session_id = ds.session_id
        JOIN DiningTable t ON ds.table_id = t.table_id
        JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
        WHERE oi.item_status IN (${placeholders}) AND ds.session_status = 'ACTIVE'
        ORDER BY fo.rowid ASC, oi.rowid ASC
    `,
        statuses
    );
}

// Map คงลำดับออเดอร์จากฐานข้อมูล ทั้งหน้าครัวและจุดเสิร์ฟใช้กลุ่มเดียวกัน
function groupOrderItems(items) {
    const rounds = new Map();
    for (const item of items) {
        if (!rounds.has(item.order_id)) {
            rounds.set(item.order_id, {
                order_id: item.order_id,
                table_no: item.table_no,
                session_id: item.session_id,
                ordered_at: item.ordered_at,
                items: [],
                pending_count: 0,
                cooking_count: 0
            });
        }
        const round = rounds.get(item.order_id);
        round.items.push(item);
        if (item.item_status === 'PENDING') round.pending_count++;
        if (item.item_status === 'COOKING') round.cooking_count++;
    }
    return [...rounds.values()];
}

module.exports = { activeOrderItems, groupOrderItems };
