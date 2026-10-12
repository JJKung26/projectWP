const db = require('../database/database');
const { randomUUID, createHash } = require('crypto');
const { check, integer, money } = require('../utils/validation');
const emit = require('../utils/events');
const { menuContent } = require('../utils/menu');
const { groupOrderItems } = require('../utils/order-rounds');

// ตรวจ QR แล้วเปิดหน้าเมนู
exports.landingQr = async function (req, res) {
  const { token } = req.params;
  const session = await db.get(
    "SELECT session_id FROM DiningSession WHERE qr_token = ? AND session_status = 'ACTIVE'",
    [token]
  );
  if (!session) {
    return res
      .status(400)
      .render('error', {
        message: 'QR Code นี้ไม่ถูกต้องหรือรอบการใช้บริการปิดไปแล้ว กรุณาติดต่อพนักงาน'
      });
  }
  res.cookie('qr_token', token, { maxAge: 4 * 60 * 60 * 1000 });
  res.redirect(`/menu?token=${token}`);
};

// Customer Menu Page
exports.getMenu = async function (req, res) {
  const session = req.diningSession;
  res.render('customer/menu', {
    session,
    ...(await menuContent()),
    token: req.qrToken,
    title: `เมนูอาหาร - โต๊ะ ${session.table_no}`
  });
};

// Place Order (Cart Submission)
exports.placeOrder = async function (req, res) {
  const { items, request_key } = req.body;
  check(
    Array.isArray(items) && items.length > 0 && items.length <= 100,
    400,
    'ต้องมีอาหาร 1–100 รายการ'
  );
  check(
    typeof request_key === 'string' && /^[a-zA-Z0-9-]{16,100}$/.test(request_key),
    400,
    'กรุณาระบุรหัสคำขอ'
  );
  const quantities = [];
  for (const item of items) {
    check(item && typeof item.menu_item_id === 'string', 400, 'รายการอาหารไม่ถูกต้องหรือซ้ำ');
    check(
      !quantities.some((row) => row[0] === item.menu_item_id),
      400,
      'รายการอาหารไม่ถูกต้องหรือซ้ำ'
    );
    const quantity = integer(item.quantity, 20, 'จำนวนอาหาร');
    quantities.push([item.menu_item_id, quantity]);
  }
  // เรียงรายการก่อนสร้างรหัส เพื่อให้ตรวจคำขอเดิมได้แม้ส่งคนละลำดับ
  const sorted = [...quantities].sort((a, b) => a[0].localeCompare(b[0]));
  const hash = createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  const result = await db.transaction(async (tx) => {
    const sessionId = req.diningSession.session_id;
    const old = await tx.get('SELECT * FROM FoodOrder WHERE session_id = ? AND request_key = ?', [
      sessionId,
      request_key
    ]);
    if (old) {
      check(old.request_hash === hash, 409, 'รหัสคำขอนี้เคยใช้กับรายการอื่น');
      return { order_id: old.order_id, replay: true };
    }
    const session = await tx.get('SELECT * FROM DiningSession WHERE session_id = ?', [sessionId]);
    check(session.session_status === 'ACTIVE', 409, 'รอบบริการปิดแล้ว');
    const last = await tx.get(
      'SELECT COALESCE(MAX(round_no),0) n FROM FoodOrder WHERE session_id = ?',
      [sessionId]
    );
    const id = randomUUID();
    await tx.run(
      'INSERT INTO FoodOrder(order_id,session_id,request_key,request_hash,round_no) VALUES(?,?,?,?,?)',
      [id, sessionId, request_key, hash, last.n + 1]
    );
    // หากรายการใดไม่ผ่าน transaction จะยกเลิกทั้งออเดอร์
    for (const [menuId, quantity] of quantities) {
      const menu = await tx.get('SELECT * FROM MenuItem WHERE menu_item_id = ?', [menuId]);
      check(menu && menu.is_active === 1, 404, 'ไม่พบเมนู');
      check(menu.availability === 1, 409, 'เมนู ' + menu.item_name + ' หมดชั่วคราว');
      money(menu.unit_price);
      await tx.run(
        `INSERT INTO OrderItem(order_item_id,order_id,menu_item_id,quantity,unit_price_at_order,item_name_at_order,charge_type_at_order)
                VALUES(?,?,?,?,?,?,?)`,
        [randomUUID(), id, menuId, quantity, menu.unit_price, menu.item_name, menu.charge_type]
      );
    }
    return { order_id: id };
  });
  if (!result.replay) {
    emit(req, 'new-order', {
      order_id: result.order_id,
      session_id: req.diningSession.session_id,
      table_no: req.diningSession.table_no
    });
  }
  res.json({ success: true, ...result });
};

// Customer Order Status Page
exports.getOrderStatus = async function (req, res) {
  const session = req.diningSession;
  const orders = await db.query(
    `SELECT oi.*, oi.item_name_at_order AS item_name, mi.image_url, fo.ordered_at, fo.round_no
     FROM OrderItem oi JOIN FoodOrder fo ON oi.order_id = fo.order_id
     JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
     WHERE fo.session_id = ? ORDER BY fo.round_no ASC, oi.rowid ASC`,
    [session.session_id]
  );
  const groups = groupOrderItems(orders);
  for (const group of groups) {
    group.roundNum = group.items[0].round_no;
  }
  res.render('customer/orders', {
    session,
    orders,
    groups,
    token: req.qrToken,
    title: `สถานะออเดอร์ - โต๊ะ ${session.table_no}`
  });
};

exports.getMenuData = async function (req, res) {
  res.json({
    success: true,
    menuItems: await db.query('SELECT menu_item_id,availability FROM MenuItem WHERE is_active = 1')
  });
};
