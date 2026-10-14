const db = require('../database/database');
// กำหนดหน้าแรกของพนักงานแต่ละหน้าที่
const HOME_BY_ROLE = {
  ADMIN: '/cashier/tables',
  CASHIER: '/cashier/tables',
  KITCHEN: '/kitchen',
  SERVICE: '/serving'
};
// เก็บการเข้าสู่ระบบในคุกกี้ที่เซ็นชื่อไว้ มีอายุ 12 ชั่วโมง
const COOKIE_OPTIONS = {
  signed: true,
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000
};

// ยอมให้พนักงานหน้าที่นั้นหรือ ADMIN เข้าได้
function requireRole(role) {
  return function (req, res, next) {
    const allowedRoles = [role, 'ADMIN'];
    for (const allowed of allowedRoles) {
      const employeeId = req.signedCookies['staff_' + allowed];
      if (!employeeId) continue;
      const sql = `SELECT employee_id, full_name, role FROM Employee WHERE
          employee_id = ?`;
      const staff = db.get(sql, [employeeId]);
      if (staff && staff.role === allowed) {
        req.staff = staff;
        res.locals.staff = staff;
        next();
        return;
      }
    }
    // ถ้ายังไม่มีสิทธิ์ ให้กลับหน้าเข้าสู่ระบบหรือแจ้งผ่าน JSON
    const accept = req.get('accept') || '';
    if (accept.includes('text/html')) {
      res.redirect('/login');
    } else {
      res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
    }
  };
}
module.exports = { requireRole, HOME_BY_ROLE, COOKIE_OPTIONS };
