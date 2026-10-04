const db = require('../database/database');

// Customer QR Landing Page Validation
exports.landingQr = async (req, res) => {
    const { token } = req.params;
    try {
        const session = await db.get(`
            SELECT s.*, t.table_no 
            FROM DiningSession s
            JOIN DiningTable t ON s.table_id = t.table_id
            WHERE s.qr_token = ? AND s.session_status = 'ACTIVE'
        `, [token]);

        if (!session) {
            return res.status(400).render('error', { 
                message: 'QR Code นี้ไม่ถูกต้องหรือรอบการใช้บริการปิดไปแล้ว กรุณาติดต่อพนักงาน' 
            });
        }

        // Store active session token in cookie or query parameter
        res.cookie('qr_token', token, { maxAge: 4 * 60 * 60 * 1000 }); // 4 hours
        res.redirect(`/menu?token=${token}`);
    } catch (err) {
        console.error('Error validating QR token:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการตรวจสอบ QR Code' });
    }
};

// Customer Menu Page
exports.getMenu = async (req, res) => {
    const session = req.diningSession;

    const categories = await db.query('SELECT * FROM Category ORDER BY sort_order ASC, category_id ASC');
    const menuItems = await db.query('SELECT * FROM MenuItem ORDER BY category_id ASC, menu_item_id ASC');

    res.render('customer/menu', {
        session,
        categories,
        menuItems,
        token: req.qrToken,
        title: `เมนูอาหาร - โต๊ะ ${session.table_no}`
    });
};

// Place Order (Cart Submission)
exports.placeOrder = async (req, res) => {
    const { items } = req.body; // items = [{ menu_item_id, quantity }]
    const session = req.diningSession;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'ข้อมูลการสั่งซื้อไม่ถูกต้อง' });
    }

    try {
        // Validate items availability
        const unavailableItems = [];
        for (const item of items) {
            const menuItem = await db.get('SELECT * FROM MenuItem WHERE menu_item_id = ?', [item.menu_item_id]);
            if (!menuItem || menuItem.availability === 0) {
                unavailableItems.push(menuItem ? menuItem.item_name : item.menu_item_id);
            }
        }

        if (unavailableItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: `ขออภัย รายการ "${unavailableItems.join(', ')}" หมดชั่วคราว ไม่สามารถสั่งได้`
            });
        }

        const orderId = 'ORD-' + Date.now();
        await db.run('INSERT INTO FoodOrder (order_id, session_id, ordered_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [orderId, session.session_id]);

        const orderItemPromises = items.map(async (item) => {
            const menuItem = await db.get('SELECT * FROM MenuItem WHERE menu_item_id = ?', [item.menu_item_id]);
            if (menuItem && item.quantity > 0) {
                const orderItemId = 'OI-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                await db.run(`
                    INSERT INTO OrderItem (order_item_id, order_id, menu_item_id, quantity, unit_price_at_order, item_status)
                    VALUES (?, ?, ?, ?, ?, 'PENDING')
                `, [orderItemId, orderId, item.menu_item_id, item.quantity, menuItem.unit_price]);
            }
        });

        await Promise.all(orderItemPromises);

        // Emit Socket Event to Kitchen and Service Staff
        const io = req.app.get('socketio');
        if (io) {
            io.emit('new-order', {
                order_id: orderId,
                table_no: session.table_no,
                session_id: session.session_id,
                item_count: items.length
            });
        }

        res.json({
            success: true,
            message: 'ส่งรายการอาหารไปยังครัวเรียบร้อยแล้ว!',
            order_id: orderId
        });
    } catch (err) {
        console.error('Error placing order:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ' });
    }
};

// Customer Order Status Page
exports.getOrderStatus = async (req, res) => {
    const session = req.diningSession;

    const orders = await db.query(`
        SELECT oi.*, mi.item_name, mi.image_url, fo.ordered_at
        FROM OrderItem oi
        JOIN FoodOrder fo ON oi.order_id = fo.order_id
        JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
        WHERE fo.session_id = ?
        ORDER BY fo.ordered_at DESC, oi.order_item_id DESC
    `, [session.session_id]);

    res.render('customer/orders', {
        session,
        orders,
        token: req.qrToken,
        title: `สถานะออเดอร์ - โต๊ะ ${session.table_no}`
    });
};
