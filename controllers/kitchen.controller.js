// อ่านรายการอาหารและรับคำสั่งจากหน้าครัว
const db = require('../database/database');
const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const { menuContent } = require('../utils/menu');
const changeItems = require('../utils/order-status');
const { check, id } = require('../utils/validation');

// แสดงออเดอร์และสต็อกในครัว
async function getDashboard(req, res) {
  const orderItems = await activeOrderItems(['PENDING', 'COOKING']);
  const orderRounds = groupOrderItems(orderItems);
  const data = await menuContent();
  data.orderItems = orderItems;
  data.orderRounds = orderRounds;
  data.pendingRounds = orderRounds.filter((round) => round.pending_count > 0);
  data.cookingRounds = orderRounds.filter(
    (round) => round.pending_count === 0 && round.cooking_count > 0
  );
  data.title = 'ครัว';
  res.render('kitchen/dashboard', data);
}

// ไม่ส่ง next ของ Express ไปเป็นพารามิเตอร์ serving ของ changeItems
function updateStatus(req, res) {
  return changeItems(req, res);
}

// รับสถานะมีของหรือของหมด แล้วบันทึกลงเมนู
async function toggleStock(req, res) {
  const { menu_item_id, availability } = req.body;
  id(menu_item_id, 'รหัสเมนู');
  check(availability === 0 || availability === 1, 400, 'สถานะสต็อกไม่ถูกต้อง');
  const result = await db.run(
    'UPDATE MenuItem SET availability = ? WHERE menu_item_id = ? AND is_active = 1',
    [availability, menu_item_id]
  );
  check(result.changes === 1, 404, 'ไม่พบเมนู');
  res.json({ success: true, availability });
}

module.exports = { getDashboard, toggleStock, updateStatus };
