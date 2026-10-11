const db = require('../database/database');
const { randomUUID, createHash } = require('crypto');
const { check, integer, money } = require('../utils/validation');
const emit = require('../utils/events');

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
    const menuItems = await db.query('SELECT * FROM MenuItem WHERE is_active = 1 ORDER BY category_id ASC, menu_item_id ASC');

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
    const { items, request_key } = req.body;
    check(Array.isArray(items) && items.length > 0 && items.length <= 100, 400, 'ต้องมีอาหาร 1–100 รายการ');
    check(typeof request_key === 'string' && /^[a-zA-Z0-9-]{16,100}$/.test(request_key), 400, 'กรุณาระบุรหัสคำขอ');
    const seen = new Set();
    for (const item of items) {
        check(item && typeof item.menu_item_id === 'string' && !seen.has(item.menu_item_id), 400, 'รายการอาหารไม่ถูกต้องหรือซ้ำ');
        integer(item.quantity, 20, 'จำนวนอาหาร');
        seen.add(item.menu_item_id);
    }
    const hash = createHash('sha256').update(JSON.stringify(items.map(i => [i.menu_item_id, Number(i.quantity)]).sort((a,b) => a[0].localeCompare(b[0])))).digest('hex');
    const result = await db.transaction(async () => {
        const sessionId = req.diningSession.session_id;
        const old = await db.get('SELECT * FROM FoodOrder WHERE session_id = ? AND request_key = ?', [sessionId,request_key]);
        if (old) {
            check(old.request_hash === hash, 409, 'รหัสคำขอนี้เคยใช้กับรายการอื่น');
            return { order_id: old.order_id, replay: true };
        }
        const session = await db.get('SELECT * FROM DiningSession WHERE session_id = ?', [sessionId]);
        check(session.session_status === 'ACTIVE', 409, 'รอบบริการปิดแล้ว');
        const validated = [];
        for (const item of items) {
            const menu = await db.get('SELECT * FROM MenuItem WHERE menu_item_id = ?', [item.menu_item_id]);
            check(menu && menu.is_active === 1, 404, 'ไม่พบเมนู');
            check(menu.availability === 1, 409, 'เมนู ' + menu.item_name + ' หมดชั่วคราว');
            money(menu.unit_price);
            validated.push({ ...item, quantity: Number(item.quantity), menu });
        }
        const last = await db.get('SELECT COALESCE(MAX(round_no),0) n FROM FoodOrder WHERE session_id = ?', [sessionId]);
        const id = randomUUID();
        await db.run('INSERT INTO FoodOrder(order_id,session_id,request_key,request_hash,round_no) VALUES(?,?,?,?,?)', [id,sessionId,request_key,hash,last.n+1]);
        for (const item of validated) {
            await db.run(`INSERT INTO OrderItem(order_item_id,order_id,menu_item_id,quantity,unit_price_at_order,item_name_at_order,charge_type_at_order)
                VALUES(?,?,?,?,?,?,?)`, [randomUUID(),id,item.menu_item_id,item.quantity,item.menu.unit_price,item.menu.item_name,item.menu.charge_type]);
        }
        return { order_id: id };
    });
    if (!result.replay) emit(req, 'new-order', { order_id: result.order_id, session_id: req.diningSession.session_id, table_no: req.diningSession.table_no });
    res.json({ success: true, ...result });
};

// Customer Order Status Page
exports.getOrderStatus = async (req, res) => {
    const session = req.diningSession;

    const orders = await db.query(`
        SELECT oi.*, oi.item_name_at_order AS item_name, mi.image_url, fo.ordered_at, fo.round_no
        FROM OrderItem oi
        JOIN FoodOrder fo ON oi.order_id = fo.order_id
        JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
        WHERE fo.session_id = ?
        ORDER BY fo.round_no ASC, oi.rowid ASC
    `, [session.session_id]);

    res.render('customer/orders', {
        session,
        orders,
        token: req.qrToken,
        title: `สถานะออเดอร์ - โต๊ะ ${session.table_no}`
    });
};

exports.getMenuData = async (req, res) => {
    res.json({ success: true, menuItems: await db.query('SELECT menu_item_id,availability FROM MenuItem WHERE is_active = 1') });
};
