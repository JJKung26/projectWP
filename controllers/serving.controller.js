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
            ORDER BY fo.rowid ASC, oi.rowid ASC
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

exports.confirmServed = (req, res) => require('../utils/order-status')(req, res, true);
