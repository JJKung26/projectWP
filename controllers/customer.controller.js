// รับคำขอจากลูกค้าเพื่อเปิดเมนู สั่งอาหาร และดูสถานะ
const db = require('../database/database');
const { randomUUID, createHash } = require('crypto');
const { check, integer, money } = require('../utils/validation');
const { menuContent } = require('../utils/menu');
const { groupOrderItems } = require('../utils/order-rounds');

// ตรวจ QR แล้วเปิดหน้าเมนู
async function landingQr(req, res) {
  const { token } = req.params;
  const session = await db.get(
    "SELECT session_id FROM DiningSession WHERE qr_token = ? AND session_status = 'ACTIVE'",
    [token]
  );
  if (!session) {
    return res.status(400).render('error', {
      message: 'QR Code นี้ไม่ถูกต้องหรือรอบการใช้บริการปิดไปแล้ว กรุณาติดต่อพนักงาน'
    });
  }
  res.cookie('qr_token', token, { maxAge: 4 * 60 * 60 * 1000 });
  res.redirect(`/menu?token=${token}`);
}

// แสดงเมนู
async function getMenu(req, res) {
  const session = req.diningSession;
  const data = await menuContent();
  data.session = session;
  data.token = req.qrToken;
  data.title = 'เมนูอาหาร - โต๊ะ ' + session.table_no;
  res.render('customer/menu', data);
}

// ตรวจรายการ แล้วบันทึกออเดอร์ทั้งชุด
async function placeOrder(req, res) {
  const { items, request_key } = req.body;
  const quantities = checkOrder(items, request_key);
  const sorted = quantities.slice().sort((first, second) => first[0].localeCompare(second[0]));
  const hash = createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  const sessionId = req.diningSession.session_id;
  const result = await db.transaction(async function (tx) {
    // คำขอซ้ำคืนออเดอร์เดิม
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
    const orderId = randomUUID();
    await tx.insert('FoodOrder', {
      order_id: orderId,
      session_id: sessionId,
      request_key,
      request_hash: hash,
      round_no: last.n + 1
    });
    // บันทึกอาหารทีละรายการ; หากผิดพลาดจะยกเลิกทั้งออเดอร์
    for (const [menuId, quantity] of quantities) {
      const menu = await tx.get('SELECT * FROM MenuItem WHERE menu_item_id = ?', [menuId]);
      check(menu && menu.is_active === 1, 404, 'ไม่พบเมนู');
      check(menu.availability === 1, 409, 'เมนู ' + menu.item_name + ' หมดชั่วคราว');
      money(menu.unit_price);
      await tx.insert('OrderItem', {
        order_item_id: randomUUID(),
        order_id: orderId,
        menu_item_id: menuId,
        quantity,
        unit_price_at_order: menu.unit_price,
        item_name_at_order: menu.item_name,
        charge_type_at_order: menu.charge_type
      });
    }
    return { order_id: orderId };
  });
  res.json({ success: true, ...result });
}

// ตรวจอาหารและจำนวนก่อนเริ่มบันทึก
function checkOrder(items, requestKey) {
  const validItems = Array.isArray(items) && items.length > 0 && items.length <= 100;
  check(validItems, 400, 'ต้องมีอาหาร 1–100 รายการ');
  check(
    typeof requestKey === 'string' && /^[a-zA-Z0-9-]{16,100}$/.test(requestKey),
    400,
    'กรุณาระบุรหัสคำขอ'
  );
  const quantities = [];
  const menuIds = [];
  for (const item of items) {
    const validItem = item && typeof item.menu_item_id === 'string';
    check(validItem && !menuIds.includes(item.menu_item_id), 400, 'รายการอาหารไม่ถูกต้องหรือซ้ำ');
    menuIds.push(item.menu_item_id);
    quantities.push([item.menu_item_id, integer(item.quantity, 20, 'จำนวนอาหาร')]);
  }
  return quantities;
}

// แสดงสถานะ แยกตามรอบที่สั่ง
async function getOrderStatus(req, res) {
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
}

// ส่งสถานะของหมดและออเดอร์ล่าสุดให้หน้าเมนู
async function getMenuData(req, res) {
  const latest = await db.get(
    'SELECT order_id FROM FoodOrder WHERE session_id = ? ORDER BY round_no DESC LIMIT 1',
    [req.diningSession.session_id]
  );
  res.json({
    success: true,
    latestOrder: latest?.order_id || null,
    menuItems: await db.query('SELECT menu_item_id,availability FROM MenuItem WHERE is_active = 1')
  });
}

module.exports = { landingQr, getMenu, placeOrder, getOrderStatus, getMenuData };
