// กำหนด URL แล้วส่งคำขอไปยัง controller
const router = require('express').Router();
const customer = require('../controllers/customer.controller');
// รับ QR แล้วพาลูกค้าไปหน้าเมนู (GET)
router.get('/qr/:token', customer.landingQr);
// ส่งสถานะเมนูล่าสุด (GET)
router.get('/menu/data', customer.getMenuData);
// แสดงเมนูอาหาร (GET)
router.get('/menu', customer.getMenu);
// รับรายการอาหารที่ลูกค้าสั่ง (POST)
router.post('/orders', customer.placeOrder);
// แสดงสถานะออเดอร์ (GET)
router.get('/orders', customer.getOrderStatus);
module.exports = router;
