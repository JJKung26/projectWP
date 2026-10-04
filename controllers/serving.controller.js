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
            ORDER BY fo.ordered_at ASC, oi.order_item_id ASC
        `);

        // Group ready items by order_id (Order Round)
        const readyRoundsMap = {};
        const readyRounds = [];

        readyItems.forEach(item => {
            if (!readyRoundsMap[item.order_id]) {
                const roundObj = {
                    order_id: item.order_id,
                    table_no: item.table_no,
                    session_id: item.session_id,
                    ordered_at: item.ordered_at,
                    items: []
                };
                readyRoundsMap[item.order_id] = roundObj;
                readyRounds.push(roundObj);
            }
            readyRoundsMap[item.order_id].items.push(item);
        });

        res.render('serving/dashboard', {
            readyItems,
            readyRounds,
            title: 'จุดเสิร์ฟ'
        });
    } catch (err) {
        console.error('Error loading serving dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลเสิร์ฟ' });
    }
};

// Confirm Item Served
exports.confirmServed = async (req, res) => {
    const { order_item_id, order_id } = req.body;
    const employee_id = req.staff.employee_id;

    try {
        if (order_id) {
            await db.run(`
                UPDATE OrderItem 
                SET item_status = 'SERVED', served_by = ?
                WHERE order_id = ? AND item_status = 'READY'
            `, [employee_id, order_id]);
        } else if (order_item_id) {
            await db.run(`
                UPDATE OrderItem 
                SET item_status = 'SERVED', served_by = ?
                WHERE order_item_id = ?
            `, [employee_id, order_item_id]);
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

        const io = req.app.get('socketio');
        if (io) {
            io.emit('order-status-changed', {
                order_id,
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
