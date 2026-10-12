const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const changeItems = require('../utils/order-status');

// แสดงอาหารที่พร้อมเสิร์ฟ
exports.getDashboard = async function (req, res) {
  const readyItems = await activeOrderItems(['READY']);
  res.render('serving/dashboard', {
    readyItems,
    readyRounds: groupOrderItems(readyItems),
    title: 'จุดเสิร์ฟ'
  });
};

exports.confirmServed = (req, res) => changeItems(req, res, true);
