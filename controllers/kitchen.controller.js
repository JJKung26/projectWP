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

        const menuItems = await db.query('SELECT * FROM MenuItem ORDER BY category_id ASC');

        res.render('kitchen/dashboard', {
            orderItems,
            orderRounds,
            pendingRounds,
            cookingRounds,
            menuItems,
            title: 'ครัว'
        });
    } catch (err) {
        console.error('Error loading kitchen dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลห้องครัว' });
    }
};

// Update Order Item Status (PENDING -> COOKING -> READY or CANCELLED)
exports.updateStatus = async (req, res) => {
    const { order_item_id, order_id, status, cancel_reason } = req.body;
    const employee_id = req.body.employee_id || 'EMP-002'; // Kitchen Staff

    if (!['COOKING', 'READY', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }

    try {
        if (order_id) {
            // Batch update all pending/cooking items in this order round
            if (status === 'COOKING') {
                await db.run(`
                    UPDATE OrderItem 
                    SET item_status = 'COOKING', prepared_by = ?
                    WHERE order_id = ? AND item_status = 'PENDING'
                `, [employee_id, order_id]);
            } else if (status === 'READY') {
                await db.run(`
                    UPDATE OrderItem 
                    SET item_status = 'READY', prepared_by = ?
                    WHERE order_id = ? AND item_status IN ('PENDING', 'COOKING')
                `, [employee_id, order_id]);
            }
        } else if (order_item_id) {
            await db.run(`
                UPDATE OrderItem 
                SET item_status = ?, prepared_by = ?, cancel_reason = ?
                WHERE order_item_id = ?
            `, [status, employee_id, cancel_reason || null, order_item_id]);

            // If item is cancelled because of out of stock, automatically set MenuItem availability = 0
            if (status === 'CANCELLED') {
                const targetItem = await db.get('SELECT menu_item_id FROM OrderItem WHERE order_item_id = ?', [order_item_id]);
                if (targetItem && targetItem.menu_item_id) {
                    await db.run('UPDATE MenuItem SET availability = 0 WHERE menu_item_id = ?', [targetItem.menu_item_id]);
                    const io = req.app.get('socketio');
                    if (io) {
                        io.emit('stock-updated', { menu_item_id: targetItem.menu_item_id, availability: 0 });
                    }
                }
            }
        } else {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ order_item_id หรือ order_id' });
        }

        const updatedItem = order_item_id ? await db.get(`
            SELECT oi.*, mi.item_name, t.table_no, fo.session_id
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN DiningSession ds ON fo.session_id = ds.session_id
            JOIN DiningTable t ON ds.table_id = t.table_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE oi.order_item_id = ?
        `, [order_item_id]) : null;

        // Emit Socket Event to Customer and Serving Staff
        const io = req.app.get('socketio');
        if (io) {
            io.emit('order-status-changed', {
                order_id,
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
        const isAvailable = (availability == 1 || availability === true || availability === '1') ? 1 : 0;
        await db.run('UPDATE MenuItem SET availability = ? WHERE menu_item_id = ?', [isAvailable, menu_item_id]);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('stock-updated', { menu_item_id, availability: isAvailable });
        }

        res.json({ success: true, message: 'อัปเดตสถานะสต็อกเรียบร้อยแล้ว', availability: isAvailable });
    } catch (err) {
        console.error('Error toggling menu item stock:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสต็อก' });
    }
};
