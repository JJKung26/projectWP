// รับคำขอเข้าสู่ระบบและออกจากระบบ
const bcrypt = require('bcryptjs');
const db = require('../database/database');
const auth = require('../middlewares/auth.middleware');

// แสดงหน้า Login พร้อมข้อความแจ้งเตือน
function renderLogin(res, error = null, username = '', next = '') {
  return res.render('auth/login', { title: 'เข้าสู่ระบบ', error, username, next });
}

// เปิดฟอร์มเข้าสู่ระบบ
function showLogin(req, res) {
  renderLogin(res, null, '', auth.safeNextPath(req.query.next) || '');
}

// รับชื่อผู้ใช้และรหัสผ่าน ตรวจบัญชี แล้วพาไปหน้าตามสิทธิ์
async function login(req, res) {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return renderLogin(res.status(400), 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
  }
  const next = auth.safeNextPath(req.body.next) || '';
  const employee = await db.get('SELECT * FROM Employee WHERE username = ?', [username]);
  if (!employee || !bcrypt.compareSync(password, employee.password_hash)) {
    return renderLogin(res.status(401), 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', username, next);
  }
  // ชื่อ cookie ผูกกับ role จึงล็อกอินหลายบทบาทพร้อมกันในเบราว์เซอร์เดียวได้
  res.cookie(auth.cookieNameFor(employee.role), employee.employee_id, auth.COOKIE_OPTIONS);
  res.redirect(next || auth.HOME_BY_ROLE[employee.role]);
}

// ล้างสถานะเข้าสู่ระบบของบัญชีที่เลือก
function logout(req, res) {
  const role = req.body.role;
  if (auth.ROLES.includes(role)) {
    res.clearCookie(auth.cookieNameFor(role), auth.COOKIE_OPTIONS);
  }
  res.redirect('/login');
}

module.exports = { showLogin, login, logout };
