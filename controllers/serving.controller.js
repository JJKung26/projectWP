// แสดงรายการพร้อมเสิร์ฟและรับการยืนยันเสิร์ฟ
const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const changeItems = require('../utils/order-status');

// แสดงอาหารที่พร้อมเสิร์ฟ
async function getDashboard(req, res) {
  const readyItems = await activeOrderItems(['READY']);
  res.render('serving/dashboard', {
    readyItems,
    readyRounds: groupOrderItems(readyItems),
    title: 'จุดเสิร์ฟ'
  });
}

// รับออเดอร์ที่เลือก แล้วเปลี่ยนสถานะเป็นเสิร์ฟแล้ว
function confirmServed(req, res) {
  return changeItems(req, res, true);
}

module.exports = { getDashboard, confirmServed };
