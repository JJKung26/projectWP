const db = require('../database/database');
const { cookieNameFor, wantsHtml } = require('./auth.helpers');

// โหลดพนักงานจากฐานข้อมูลใหม่ทุกครั้ง ไม่เก็บ role ไว้ใน cookie
// เพื่อให้การแก้บทบาทหรือลบพนักงานมีผลทันที
// และไม่เอาข้อมูลจากฝั่ง client มาตัดสินสิทธิ์โดยตรง
async function loadStaff(employeeId, expectedRole) {
    if (!employeeId) return null;
    const row = await db.get(
        'SELECT employee_id, username, full_name, role FROM Employee WHERE employee_id = ?',
        [employeeId]
    );
    if (!row || row.role !== expectedRole) return null;
    return row;
}

// หาพนักงานที่มีสิทธิ์เข้าถึง: cookie ของ role นั้นก่อน ถ้าไม่มีลอง cookie ของ ADMIN
async function resolveStaff(req, role) {
    const cookies = req.signedCookies || {};
    const byRole = await loadStaff(cookies[cookieNameFor(role)], role);
    if (byRole) return byRole;
    if (role === 'ADMIN') return null; // กันไม่ให้ query ซ้ำด้วย cookie/role เดิมอีกครั้ง
    return loadStaff(cookies[cookieNameFor('ADMIN')], 'ADMIN');
}

function requireRole(role) {
    return async function (req, res, next) {
        let staff;
        try {
            staff = await resolveStaff(req, role);
        } catch (err) {
            // ถ้า db.get() reject (เช่น DB ปิดอยู่) ต้องจับไว้เอง เพราะโปรเจกต์นี้
            // ยังไม่มี global error handler (จะถูกสร้างใน Task 8) — ถ้าไม่จับ
            // error จะตกไปที่ default handler ของ Express ซึ่งตอบเป็น HTML เสมอ
            // เป็นบั๊กคลาสเดียวกับที่ middleware นี้ป้องกันตอน 401
            console.error('requireRole: ตรวจสอบสิทธิ์ล้มเหลว:', err);
            const message = 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ กรุณาลองใหม่อีกครั้ง';
            if (wantsHtml(req)) {
                return res.status(500).render('error', { message });
            }
            return res.status(500).json({ success: false, message });
        }

        if (staff) {
            req.staff = staff;          // ให้ controller ใช้แทน employee_id ที่ hardcode
            res.locals.staff = staff;   // ให้ view ใช้แสดงชื่อบน navbar
            return next();
        }

        // ตอบคนละแบบตามชนิดของ request
        // ถ้า redirect request ที่มาจาก fetch() ฝั่งเบราว์เซอร์จะได้ HTML
        // แล้ว res.json() จะพังเงียบ ๆ ด้วย Unexpected token '<'
        if (wantsHtml(req)) {
            return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
        }
        return res.status(401).json({
            success: false,
            message: 'กรุณาเข้าสู่ระบบอีกครั้ง'
        });
    };
}

module.exports = { requireRole };
