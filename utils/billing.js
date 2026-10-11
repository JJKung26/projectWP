const db = require('../database/database');
const { money } = require('./validation');
function totals(session, items) {
    const children = session.child_count || 0;
    const adults = session.guest_count - children - (session.free_child_count || 0);
    const buffet =
        adults * money(session.buffet_price) + children * money(session.child_price ?? 179);
    const extra = items.reduce(
        (total, item) =>
            total +
            (item.charge_type === 'ALACARTE' ? item.quantity * money(item.unit_price_at_order) : 0),
        0
    );
    const subtotal = buffet + extra;
    const tax = Math.round((subtotal * 7) / 100);
    const before = subtotal + tax;
    const net = Math.floor(before / 100) * 100;
    return {
        buffetTotal: buffet / 100,
        alacarteTotal: extra / 100,
        subtotal: subtotal / 100,
        taxAmount: tax / 100,
        beforeRounding: before / 100,
        roundingAmount: (net - before) / 100,
        netAmount: net / 100
    };
}
const itemsFor = sessionId =>
    db.query(
        `SELECT oi.*, oi.item_name_at_order AS item_name,
    oi.charge_type_at_order AS charge_type FROM OrderItem oi JOIN FoodOrder fo ON fo.order_id = oi.order_id
    WHERE fo.session_id = ? AND oi.item_status != 'CANCELLED' ORDER BY fo.rowid, oi.rowid`,
        [sessionId]
    );
module.exports = { totals, itemsFor };
