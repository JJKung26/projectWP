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
    const existingOrder = db.get(
      `SELECT order_id FROM FoodOrder
        WHERE session_id = ? AND request_key = ?`,
      [sessionId, requestKey]
    );
    if (existingOrder) return existingOrder.order_id;
    const lastRound = db.get(
      `SELECT COALESCE(MAX(round_no), 0) AS roundNumber FROM FoodOrder
        WHERE session_id = ?`,
      [sessionId]
    );
    const newOrderId = randomUUID();
    const orderSql = `INSERT INTO FoodOrder (order_id, session_id, request_key, round_no)
      VALUES (?, ?, ?, ?)`;
    db.run(orderSql, [newOrderId, sessionId, requestKey, lastRound.roundNumber + 1]);

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
      db.run(itemSql, [
        randomUUID(), newOrderId, menu.menu_item_id, quantity,
        menu.unit_price, menu.item_name, menu.charge_type
      ]);
    }
    return newOrderId;
  });
  res.json({ success: true, order_id: orderId });
}

// อ่านอาหารของโต๊ะและรวมตามรอบ เพื่อแสดงสถานะ
function getOrderStatus(req, res) {
  const sql = `SELECT orderItem.*, orderItem.item_name_at_order AS item_name, menuItem.image_url,
    foodOrder.ordered_at, foodOrder.round_no
    FROM OrderItem orderItem
    JOIN FoodOrder foodOrder ON orderItem.order_id = foodOrder.order_id
    JOIN MenuItem menuItem ON orderItem.menu_item_id = menuItem.menu_item_id
    WHERE foodOrder.session_id = ?
    ORDER BY foodOrder.round_no, orderItem.rowid`;
  const orders = db.query(sql, [req.diningSession.session_id]);
  res.render('customer/orders', { orders, groups: groupOrderItems(orders) });
}

// ส่งสถานะของหมดให้หน้าเมนูอัปเดตทุก 5 วินาที
function getMenuData(req, res) {
  const menuItems = db.query(`SELECT menu_item_id, availability FROM MenuItem WHERE is_active = 1`);
  res.json({ success: true, menuItems });
}
module.exports = { landingQr, getMenu, placeOrder, getOrderStatus, getMenuData };
