const db = require('../database/database');
const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const { menuContent } = require('../utils/menu');
const changeItems = require('../utils/order-status');
const { check, id } = require('../utils/validation');
const emit = require('../utils/events');

// Kitchen Live Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const orderItems = await activeOrderItems(['PENDING', 'COOKING']);
        const orderRounds = groupOrderItems(orderItems);

        // Separate rounds into pending (รอคิว - WAITING) and cooking (กำลังทำ - PREPARING)
        const pendingRounds = orderRounds.filter(r => r.pending_count > 0);
        const cookingRounds = orderRounds.filter(r => r.pending_count === 0 && r.cooking_count > 0);

        res.render('kitchen/dashboard', {
            orderItems,
            orderRounds,
            pendingRounds,
            cookingRounds,
            ...(await menuContent()),
            title: 'ครัว'
        });
    } catch (err) {
        console.error('Error loading kitchen dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลห้องครัว' });
    }
};

// ไม่ส่ง next ของ Express ไปเป็นพารามิเตอร์ serving ของ changeItems
exports.updateStatus = (req, res) => changeItems(req, res);
exports.toggleStock = async (req, res) => {
    const { menu_item_id, availability } = req.body;
    id(menu_item_id, 'รหัสเมนู');
    check(availability === 0 || availability === 1, 400, 'สถานะสต็อกไม่ถูกต้อง');
    const result = await db.transaction(() =>
        db.run('UPDATE MenuItem SET availability = ? WHERE menu_item_id = ? AND is_active = 1', [
            availability,
            menu_item_id
        ])
    );
    check(result.changes === 1, 404, 'ไม่พบเมนู');
    emit(req, 'stock-updated', { menu_item_id, availability });
    res.json({ success: true, availability });
};
