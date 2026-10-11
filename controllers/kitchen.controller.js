const db = require('../database/database');

// Kitchen Live Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const orderItems = await db.query(`
            SELECT oi.*, mi.item_name, mi.image_url, t.table_no, fo.session_id, fo.ordered_at
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN DiningSession ds ON fo.session_id = ds.session_id
            JOIN DiningTable t ON ds.table_id = t.table_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE oi.item_status IN ('PENDING', 'COOKING') AND ds.session_status = 'ACTIVE'
            ORDER BY fo.rowid ASC, oi.rowid ASC
        `);

        // Group order items by order_id (Order Round)
        const orderRoundsMap = {};
        const orderRounds = [];

        orderItems.forEach(item => {
            if (!orderRoundsMap[item.order_id]) {
                const roundObj = {
                    order_id: item.order_id,
                    table_no: item.table_no,
                    session_id: item.session_id,
                    ordered_at: item.ordered_at,
                    items: [],
                    pending_count: 0,
                    cooking_count: 0
                };
                orderRoundsMap[item.order_id] = roundObj;
                orderRounds.push(roundObj);
            }
            orderRoundsMap[item.order_id].items.push(item);
            if (item.item_status === 'PENDING') orderRoundsMap[item.order_id].pending_count++;
            if (item.item_status === 'COOKING') orderRoundsMap[item.order_id].cooking_count++;
        });

        // Separate rounds into pending (รอคิว - WAITING) and cooking (กำลังทำ - PREPARING)
        const pendingRounds = orderRounds.filter(r => r.pending_count > 0);
        const cookingRounds = orderRounds.filter(r => r.pending_count === 0 && r.cooking_count > 0);

        const categories = await db.query('SELECT * FROM Category ORDER BY sort_order ASC, category_id ASC');
        const menuItems = await db.query('SELECT * FROM MenuItem WHERE is_active = 1 ORDER BY category_id ASC, menu_item_id ASC');

        res.render('kitchen/dashboard', {
            orderItems,
            orderRounds,
            pendingRounds,
            cookingRounds,
            categories,
            menuItems,
            title: 'ครัว'
        });
    } catch (err) {
        console.error('Error loading kitchen dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลห้องครัว' });
    }
};


exports.updateStatus = (req, res) => require('../utils/order-status')(req, res);
exports.toggleStock = async (req, res) => {
    const { menu_item_id, availability } = req.body;
    const { check, id } = require('../utils/validation');
    id(menu_item_id, 'รหัสเมนู');
    check(availability === 0 || availability === 1, 400, 'สถานะสต็อกไม่ถูกต้อง');
    const result = await db.transaction(() => db.run('UPDATE MenuItem SET availability = ? WHERE menu_item_id = ? AND is_active = 1', [availability,menu_item_id]));
    check(result.changes === 1, 404, 'ไม่พบเมนู');
    require('../utils/events')(req, 'stock-updated', { menu_item_id, availability });
    res.json({ success: true, availability });
};
