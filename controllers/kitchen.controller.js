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
            ORDER BY fo.ordered_at ASC, oi.order_item_id ASC
        `);

        const menuItems = await db.query('SELECT * FROM MenuItem ORDER BY category_id ASC');

        res.render('kitchen/dashboard', {
            orderItems,
            menuItems,
            title: 'ห้องครัว (Kitchen Dashboard)'
        });
    } catch (err) {
        console.error('Error loading kitchen dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลห้องครัว' });
    }
};

// Update Order Item Status (PENDING -> COOKING -> READY or CANCELLED)
exports.updateStatus = async (req, res) => {
    const { order_item_id, status, cancel_reason } = req.body;
    const employee_id = req.body.employee_id || 'EMP-002'; // Kitchen Staff

    if (!['COOKING', 'READY', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }

    try {
        await db.run(`
            UPDATE OrderItem 
            SET item_status = ?, prepared_by = ?, cancel_reason = ?
            WHERE order_item_id = ?
        `, [status, employee_id, cancel_reason || null, order_item_id]);

        const updatedItem = await db.get(`
            SELECT oi.*, mi.item_name, t.table_no, fo.session_id
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN DiningSession ds ON fo.session_id = ds.session_id
            JOIN DiningTable t ON ds.table_id = t.table_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE oi.order_item_id = ?
        `, [order_item_id]);

        // Emit Socket Event to Customer and Serving Staff
        const io = req.app.get('socketio');
        if (io) {
            io.emit('order-status-changed', {
                order_item_id,
                item_name: updatedItem ? updatedItem.item_name : '',
                status,
                table_no: updatedItem ? updatedItem.table_no : '',
                session_id: updatedItem ? updatedItem.session_id : ''
            });
        }

        res.json({ success: true, message: `อัปเดตสถานะเป็น ${status} แล้ว` });
    } catch (err) {
        console.error('Error updating kitchen order item:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
};

// Toggle Food Availability (In Stock / Out of Stock)
exports.toggleStock = async (req, res) => {
    const { menu_item_id, availability } = req.body;
    try {
        const isAvailable = availability ? 1 : 0;
        await db.run('UPDATE MenuItem SET availability = ? WHERE menu_item_id = ?', [isAvailable, menu_item_id]);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('stock-updated', { menu_item_id, availability: isAvailable });
        }

        res.json({ success: true, message: 'อัปเดตสถานะสต็อกเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error toggling menu item stock:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสต็อก' });
    }
};
