const db = require('../database/database');

// Serving Staff Dashboard
exports.getDashboard = async (req, res) => {
    try {
        // Items ready to be served
        const readyItems = await db.query(`
            SELECT oi.*, mi.item_name, mi.image_url, t.table_no, fo.session_id, fo.ordered_at
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN DiningSession ds ON fo.session_id = ds.session_id
            JOIN DiningTable t ON ds.table_id = t.table_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE oi.item_status = 'READY' AND ds.session_status = 'ACTIVE'
            ORDER BY fo.ordered_at ASC
        `);

        res.render('serving/dashboard', {
            readyItems,
            title: 'จุดเสิร์ฟ'
        });
    } catch (err) {
        console.error('Error loading serving dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลเสิร์ฟ' });
    }
};

// Confirm Item Served
exports.confirmServed = async (req, res) => {
    const { order_item_id } = req.body;
    const employee_id = req.body.employee_id || 'EMP-003';

    try {
        await db.run(`
            UPDATE OrderItem 
            SET item_status = 'SERVED', served_by = ?
            WHERE order_item_id = ?
        `, [employee_id, order_item_id]);

        const updatedItem = await db.get(`
            SELECT oi.*, mi.item_name, t.table_no, fo.session_id
            FROM OrderItem oi
            JOIN FoodOrder fo ON oi.order_id = fo.order_id
            JOIN DiningSession ds ON fo.session_id = ds.session_id
            JOIN DiningTable t ON ds.table_id = t.table_id
            JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
            WHERE oi.order_item_id = ?
        `, [order_item_id]);

        const io = req.app.get('socketio');
        if (io) {
            io.emit('order-status-changed', {
                order_item_id,
                item_name: updatedItem ? updatedItem.item_name : '',
                status: 'SERVED',
                table_no: updatedItem ? updatedItem.table_no : '',
                session_id: updatedItem ? updatedItem.session_id : ''
            });
        }

        res.json({ success: true, message: 'ยืนยันเสิร์ฟเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error confirming served item:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันเสิร์ฟ' });
    }
};
