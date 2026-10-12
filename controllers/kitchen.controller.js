const db = require('../database/database');
const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const { menuContent } = require('../utils/menu');
const changeItems = require('../utils/order-status');
const { check, id } = require('../utils/validation');
const emit = require('../utils/events');

// แสดงออเดอร์และสต็อกในครัว
exports.getDashboard = async function (req, res) {
  const orderItems = await activeOrderItems(['PENDING', 'COOKING']);
  const orderRounds = groupOrderItems(orderItems);
  res.render('kitchen/dashboard', {
    orderItems,
    orderRounds,
    pendingRounds: orderRounds.filter((round) => round.pending_count > 0),
    cookingRounds: orderRounds.filter(
      (round) => round.pending_count === 0 && round.cooking_count > 0
    ),
    ...(await menuContent()),
    title: 'ครัว'
  });
};

// ไม่ส่ง next ของ Express ไปเป็นพารามิเตอร์ serving ของ changeItems
exports.updateStatus = (req, res) => changeItems(req, res);

exports.toggleStock = async function (req, res) {
  const { menu_item_id, availability } = req.body;
  id(menu_item_id, 'รหัสเมนู');
  check(availability === 0 || availability === 1, 400, 'สถานะสต็อกไม่ถูกต้อง');
  const result = await db.transaction((tx) =>
    tx.run('UPDATE MenuItem SET availability = ? WHERE menu_item_id = ? AND is_active = 1', [
      availability,
      menu_item_id
    ])
  );
  check(result.changes === 1, 404, 'ไม่พบเมนู');
  emit(req, 'stock-updated', { menu_item_id, availability });
  res.json({ success: true, availability });
};
