const db = require('../database/database');
const { randomUUID } = require('crypto');
const { fail, integer } = require('../utils/validation');
const { menuContent } = require('../utils/menu');
const { groupOrderItems } = require('../utils/order-rounds');

// พาลูกค้าจากลิงก์ QR ไปหน้าเมนูของโต๊ะ
function landingQr(req, res) {
  res.redirect('/menu?token=' + req.params.token);
}

// เตรียมหมวดอาหาร ราคา รูป และข้อมูลที่ตะกร้าต้องใช้
function getMenu(req, res) {
  const data = menuContent();
  data.cartItems = {};
  for (const item of data.menuItems) {
    data.cartItems[item.menu_item_id] = {
      name: item.item_name,
      img: item.image_url,
      price: item.charge_type === 'ALACARTE' ? item.unit_price : 0,
      available: item.availability === 1
    };
  }
  res.render('customer/menu', data);
}

// รับรายการที่เลือก แล้วบันทึกออเดอร์กับอาหารทั้งชุด
function placeOrder(req, res) {
  const items = req.body.items;
  const requestKey = req.body.request_key;
  const sessionId = req.diningSession.session_id;
  if (!items || items.length === 0) fail('กรุณาเลือกอาหาร');
  const orderId = db.transaction(function () {
    // 1. ถ้ากดส่งรายการเดิมซ้ำ ให้ใช้รหัสออเดอร์เดิม
    const old = db.get(
      `SELECT order_id FROM FoodOrder
        WHERE session_id = ? AND request_key = ?`,
      [sessionId, requestKey]
    );
    if (old) return old.order_id;
    const last = db.get(
      `SELECT COALESCE(MAX(round_no), 0) n FROM FoodOrder
        WHERE session_id = ?`,
      [sessionId]
    );
    const id = randomUUID();
    const orderSql = `INSERT INTO FoodOrder (order_id, session_id, request_key, round_no)
      VALUES (?, ?, ?, ?)`;
    db.run(orderSql, [id, sessionId, requestKey, last.n + 1]);

    // 2. อ่านราคาและสต็อก แล้วบันทึกอาหารแต่ละรายการ
    const itemSql = `INSERT INTO OrderItem
      (order_item_id, order_id, menu_item_id, quantity,
       unit_price_at_order, item_name_at_order, charge_type_at_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    for (const item of items) {
      const quantity = integer(item.quantity, 20, 'จำนวนอาหาร');
      const menu = db.get(`SELECT * FROM MenuItem WHERE menu_item_id = ? AND is_active = 1`, [
        item.menu_item_id
      ]);
      if (!menu || menu.availability !== 1) fail('อาหารที่เลือกหมดชั่วคราว', 409);
      const values = [
        randomUUID(),
        id,
        menu.menu_item_id,
        quantity,
        menu.unit_price,
        menu.item_name,
        menu.charge_type
      ];
      db.run(itemSql, values);
    }
    return id;
  });
  res.json({ success: true, order_id: orderId });
}

// อ่านอาหารของโต๊ะและรวมตามรอบ เพื่อแสดงสถานะ
function getOrderStatus(req, res) {
  const sql = `SELECT oi.*, oi.item_name_at_order AS item_name, mi.image_url,
    fo.ordered_at, fo.round_no
    FROM OrderItem oi
    JOIN FoodOrder fo ON oi.order_id = fo.order_id
    JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
    WHERE fo.session_id = ?
    ORDER BY fo.round_no, oi.rowid`;
  const orders = db.query(sql, [req.diningSession.session_id]);
  res.render('customer/orders', { orders, groups: groupOrderItems(orders) });
}

// ส่งสถานะของหมดให้หน้าเมนูอัปเดตทุก 5 วินาที
function getMenuData(req, res) {
  const menuItems = db.query(`SELECT menu_item_id, availability FROM MenuItem WHERE is_active = 1`);
  res.json({ success: true, menuItems });
}
module.exports = {
  landingQr,
  getMenu,
  placeOrder,
  getOrderStatus,
  getMenuData
};
