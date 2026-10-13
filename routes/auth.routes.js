// กำหนด URL แล้วส่งคำขอไปยัง controller
const router = require('express').Router();
const auth = require('../controllers/auth.controller');
// เปิดหน้าเข้าสู่ระบบ (GET)
router.get('/login', auth.showLogin);
// รับชื่อผู้ใช้และรหัสผ่านเพื่อตรวจบัญชี (POST)
router.post('/login', auth.login);
// รับคำสั่งออกจากระบบ (POST)
router.post('/logout', auth.logout);
module.exports = router;
