// กำหนด URL แล้วส่งคำขอไปยัง controller
const router = require('express').Router();
const cashier = require('../controllers/cashier.controller');
// แสดงประวัติใบเสร็จ (GET)
router.get('/cashier/receipts', cashier.getReceipts);
// แสดงหน้าจัดการโต๊ะ (GET)
router.get('/cashier', cashier.getTables);
// แสดงโต๊ะและคิว (GET)
router.get('/cashier/tables', cashier.getTables);
// รับข้อมูลเปิดโต๊ะ (POST)
router.post('/cashier/open-table', cashier.openTable);
// อ่านใบ QR ของรอบบริการ (GET)
router.get('/cashier/qr/:token', cashier.getQrCode);
// แสดงบิลหรือใบเสร็จ (GET)
router.get('/cashier/bill/:sessionId', cashier.getBill);
// รับข้อมูลการชำระเงิน (POST)
router.post('/cashier/payment', cashier.processPayment);
// รับคำสั่งคืนโต๊ะเป็นว่าง (POST)
router.post('/cashier/reset-table', cashier.resetTable);
module.exports = router;
