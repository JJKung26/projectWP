const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const changeItems = require('../utils/order-status');

// รวมอาหารที่ครัวทำเสร็จแล้ว เพื่อแสดงรอบรอนำไปเสิร์ฟ
function getDashboard(req, res) {
  const readyItems = activeOrderItems('READY');
  res.render('serving/dashboard', {
    readyItems,
    readyRounds: groupOrderItems(readyItems),
    title: 'จุดเสิร์ฟ'
  });
}
// ยืนยันว่าอาหารในรอบนี้เสิร์ฟแล้วผ่านฟังก์ชันกลาง
function confirmServed(req, res) { changeItems(req, res, true); }
module.exports = { getDashboard, confirmServed };
