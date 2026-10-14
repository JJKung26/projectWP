const db = require('../database/database');
const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const { menuContent } = require('../utils/menu');
const changeItems = require('../utils/order-status');
const { fail } = require('../utils/validation');

// แยกออเดอร์รอทำกับกำลังทำ และเตรียมเมนูสำหรับแท็บสต็อก
function getDashboard(req, res) {
  const data = menuContent();
  data.orderItems = activeOrderItems('PENDING', 'COOKING');
  data.orderRounds = groupOrderItems(data.orderItems);
  data.pendingRounds = [];
  data.cookingRounds = [];
  for (const round of data.orderRounds) {
    if (round.counts.PENDING) data.pendingRounds.push(round);
    else data.cookingRounds.push(round);
  }
  data.title = 'ครัว';
  res.render('kitchen/dashboard', data);
}

// บันทึกว่าเมนูมีของหรือหมดชั่วคราว
function toggleStock(req, res) {
  const body = req.body;
  if (body.availability !== 0 && body.availability !== 1) fail('สถานะสต็อกไม่ถูกต้อง');
  db.run(`UPDATE MenuItem SET availability = ? WHERE menu_item_id = ?`, [
    body.availability,
    body.menu_item_id
  ]);
  res.json({ success: true });
}
// ส่งคำสั่งครัวให้ฟังก์ชันกลาง โดยรับเฉพาะ req และ res
function updateStatus(req, res) { changeItems(req, res); }
module.exports = { getDashboard, updateStatus, toggleStock };
