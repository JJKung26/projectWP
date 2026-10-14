const bcrypt = require('bcryptjs');
const db = require('../database/database');
const { HOME_BY_ROLE, COOKIE_OPTIONS } = require('../middlewares/auth.middleware');

// แสดงฟอร์มเข้าสู่ระบบ
function showLogin(req, res) {
  res.render('auth/login', { title: 'เข้าสู่ระบบ', error: '', username: '' });
}

// ตรวจชื่อผู้ใช้กับรหัสผ่าน แล้วเข้าไปยังหน้าตามหน้าที่
function login(req, res) {
  const username = req.body.username || '';
  const password = req.body.password || '';
  const sql = 'SELECT * FROM Employee WHERE username = ?';
  const employee = db.get(sql, [username]);
  if (!employee || !bcrypt.compareSync(password, employee.password_hash)) {
    res.status(401).render('auth/login', {
      title: 'เข้าสู่ระบบ',
      error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      username
    });
    return;
  }
  res.cookie('staff_' + employee.role, employee.employee_id, COOKIE_OPTIONS);
  res.redirect(HOME_BY_ROLE[employee.role]);
}

// ล้างคุกกี้ของหน้าที่ที่ออกจากระบบ แล้วกลับหน้าเข้าสู่ระบบ
function logout(req, res) {
  res.clearCookie('staff_' + req.body.role, COOKIE_OPTIONS);
  res.redirect('/login');
}
module.exports = { showLogin, login, logout };
