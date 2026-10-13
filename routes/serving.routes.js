// กำหนด URL แล้วส่งคำขอไปยัง controller
const router = require('express').Router();
const serving = require('../controllers/serving.controller');
// แสดงอาหารที่พร้อมเสิร์ฟ (GET)
router.get('/serving', serving.getDashboard);
// รับการยืนยันเสิร์ฟอาหาร (POST)
router.post('/serving/confirm-served', serving.confirmServed);
module.exports = router;
