const bcrypt = require('bcryptjs');
const db = require('../database/database');
const {
  ROLES,
  COOKIE_OPTIONS,
  HOME_BY_ROLE,
  cookieNameFor,
  safeNextPath
} = require('../middlewares/auth.middleware');

function renderLogin(res, values = {}) {
  const defaults = { title: 'เข้าสู่ระบบ', error: null, username: '', next: '' };
  return res.render('auth/login', { ...defaults, ...values });
}

exports.showLogin = function (req, res) {
  renderLogin(res, { next: safeNextPath(req.query.next) || '' });
};

exports.login = async function (req, res) {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return renderLogin(res.status(400), { error: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง' });
  }
  const next = safeNextPath(req.body.next);
  const employee = await db.get('SELECT * FROM Employee WHERE username = ?', [username]);
  const passwordOk = employee && bcrypt.compareSync(password, employee.password_hash);
  if (!passwordOk) {
    // ไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน เพื่อกันการไล่เดาว่ามีบัญชีไหนอยู่บ้าง
    return renderLogin(res.status(401), {
      error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      username,
      next: next || ''
    });
  }
  // ชื่อ cookie ผูกกับ role จึงล็อกอินหลายบทบาทพร้อมกันในเบราว์เซอร์เดียวได้
  res.cookie(cookieNameFor(employee.role), employee.employee_id, COOKIE_OPTIONS);
  res.redirect(next || HOME_BY_ROLE[employee.role]);
};

exports.logout = function (req, res) {
  const role = req.body.role;
  if (ROLES.includes(role)) {
    res.clearCookie(cookieNameFor(role), COOKIE_OPTIONS);
  }
  res.redirect('/login');
};
