const { activeOrderItems, groupOrderItems } = require('../utils/order-rounds');
const changeItems = require('../utils/order-status');

// Serving Staff Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const readyItems = await activeOrderItems(['READY']);
        const readyRounds = groupOrderItems(readyItems);

        res.render('serving/dashboard', {
            readyItems,
            readyRounds,
            title: 'จุดเสิร์ฟ'
        });
    } catch (err) {
        console.error('Error loading serving dashboard:', err);
        res.status(500).render('error', { message: 'เกิดข้อผิดพลาดในการโหลดข้อมูลเสิร์ฟ' });
    }
};

exports.confirmServed = (req, res) => changeItems(req, res, true);
