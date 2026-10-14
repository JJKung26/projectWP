const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const customer = require('../controllers/customer.controller');
const cashier = require('../controllers/cashier.controller');
const payment = require('../controllers/payment.controller');
const queue = require('../controllers/queue.controller');
const kitchen = require('../controllers/kitchen.controller');
const serving = require('../controllers/serving.controller');

// เข้าสู่ระบบและออกจากระบบพนักงาน
router.get('/login', auth.showLogin);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
// ลูกค้าสแกน QR ดูเมนู ส่งออเดอร์ และดูสถานะอาหาร
router.get('/qr/:token', customer.landingQr);
router.get('/menu/data', customer.getMenuData);
router.get('/menu', customer.getMenu);
router.post('/orders', customer.placeOrder);
router.get('/orders', customer.getOrderStatus);
// แคชเชียร์จัดโต๊ะ แสดง QR เช็กบิล และรับเงิน
router.get('/cashier/receipts', payment.getReceipts);
router.get('/cashier', cashier.getTables);
router.get('/cashier/tables', cashier.getTables);
router.post('/cashier/open-table', cashier.openTable);
router.get('/cashier/qr/:token', cashier.getQrCode);
router.get('/cashier/bill/:sessionId', payment.getBill);
router.post('/cashier/payment', payment.processPayment);
router.post('/cashier/reset-table', cashier.resetTable);
// ออกบัตรคิว ดูคิว เรียกคิว จัดโต๊ะ และยกเลิกคิว
router.get('/cashier/queue/ticket/:id', queue.getTicket);
router.post('/cashier/queue/issue', queue.issueQueue);
router.get('/cashier/queue/list', queue.getQueues);
router.post('/cashier/queue/call', queue.callQueue);
router.post('/cashier/queue/seat', queue.seatQueue);
router.post('/cashier/queue/cancel', queue.cancelQueue);
// ครัวดูออเดอร์ เปลี่ยนสถานะอาหาร และปรับสต็อก
router.get('/kitchen', kitchen.getDashboard);
router.post('/kitchen/update-status', kitchen.updateStatus);
router.post('/kitchen/toggle-stock', kitchen.toggleStock);
// จุดเสิร์ฟดูอาหารพร้อมเสิร์ฟ และยืนยันส่งถึงโต๊ะ
router.get('/serving', serving.getDashboard);
router.post('/serving/confirm-served', serving.confirmServed);
module.exports = router;
