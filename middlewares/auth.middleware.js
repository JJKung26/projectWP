const db = require('../database/database');
const ROLES = ['ADMIN', 'CASHIER', 'KITCHEN', 'SERVICE'];
const COOKIE_OPTIONS = {
  httpOnly: true,
  signed: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: 12 * 60 * 60 * 1000 // 12 ชั่วโมง
};
const HOME_BY_ROLE = {
  ADMIN: '/cashier/tables',
  CASHIER: '/cashier/tables',
  KITCHEN: '/kitchen',
  SERVICE: '/serving'
};

function cookieNameFor(role) {
  return 'staff_' + role;
}

// เปิดหน้าเว็บให้ไปหน้า login ส่วน fetch ให้รับข้อความ JSON
function wantsHtml(req) {
  return (req.get('accept') || '').includes('text/html');
}

// รับเฉพาะ path ภายในเว็บ กันไม่ให้ ?next= พาผู้ใช้ออกไปเว็บอื่น
function safeNextPath(next) {
  if (
    typeof next !== 'string' ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.startsWith('/\\')
  ) {
    return null;
  }
  return next;
}

// ตรวจบัญชีของหน้านี้ก่อน แล้วจึงลองบัญชี ADMIN
async function resolveStaff(req, role) {
  const cookies = req.signedCookies || {};
  const roles = role === 'ADMIN' ? ['ADMIN'] : [role, 'ADMIN'];
  for (const expectedRole of roles) {
    const employeeId = cookies[cookieNameFor(expectedRole)];
    if (!employeeId) {
      continue;
    }
    const staff = await db.get(
      'SELECT employee_id, username, full_name, role FROM Employee WHERE employee_id = ?',
      [employeeId]
    );
    if (staff && staff.role === expectedRole) {
      return staff;
    }
  }
  return null;
}

function requireRole(role) {
  return async function (req, res, next) {
    const staff = await resolveStaff(req, role);
    if (staff) {
      req.staff = staff;
      res.locals.staff = staff;
      return next();
    }
    if (wantsHtml(req)) {
      return res.redirect('/login');
    }
    return res
      .status(Object.values(req.signedCookies || {}).some(Boolean) ? 403 : 401)
      .json({ success: false, message: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
  };
}
module.exports = {
  requireRole,
  resolveStaff,
  ROLES,
  COOKIE_OPTIONS,
  HOME_BY_ROLE,
  cookieNameFor,
  wantsHtml,
  safeNextPath
};
