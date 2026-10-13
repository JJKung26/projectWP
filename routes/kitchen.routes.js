// กำหนด URL แล้วส่งคำขอไปยัง controller
const router = require('express').Router();
const kitchen = require('../controllers/kitchen.controller');
// แสดงรายการอาหารและสต็อกในครัว (GET)
router.get('/kitchen', kitchen.getDashboard);
// รับสถานะอาหารใหม่ (POST)
router.post('/kitchen/update-status', kitchen.updateStatus);
// รับคำสั่งเปลี่ยนสถานะของหมด (POST)
router.post('/kitchen/toggle-stock', kitchen.toggleStock);
module.exports = router;
