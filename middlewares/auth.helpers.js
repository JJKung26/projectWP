// ค่าคงที่และฟังก์ชันล้วนของระบบยืนยันตัวตน
// แยกออกมาจาก auth.middleware.js เพื่อให้ทดสอบได้โดยไม่ต้องแตะฐานข้อมูล

const ROLES = ['ADMIN', 'CASHIER', 'KITCHEN', 'SERVICE'];

const COOKIE_PREFIX = 'staff_';

const COOKIE_OPTIONS = {
    httpOnly: true,
    signed: true,
    sameSite: 'strict',
    secure: false,              // ต้องเป็น false เพราะรันบน http://localhost ตอนตรวจงาน
    maxAge: 12 * 60 * 60 * 1000 // 12 ชั่วโมง
};

const HOME_BY_ROLE = {
    ADMIN: '/cashier/tables',
    CASHIER: '/cashier/tables',
    KITCHEN: '/kitchen',
    SERVICE: '/serving'
};

function cookieNameFor(role) {
    return COOKIE_PREFIX + role;
}

// แยกการเปิดหน้าเว็บออกจากการเรียก fetch()
// เบราว์เซอร์ส่ง Accept: text/html,... เมื่อเปิดหน้าเว็บ
// ส่วน fetch() ที่ไม่ได้ตั้ง Accept ส่ง */*
function wantsHtml(req) {
    return (req.get('accept') || '').includes('text/html');
}

// รับเฉพาะ path ภายในเว็บ กันไม่ให้ ?next= พาผู้ใช้ออกไปเว็บอื่น
function safeNextPath(next) {
    if (typeof next !== 'string') return null;
    if (!next.startsWith('/')) return null;
    if (next.startsWith('//')) return null;
    return next;
}

module.exports = {
    ROLES,
    COOKIE_PREFIX,
    COOKIE_OPTIONS,
    HOME_BY_ROLE,
    cookieNameFor,
    wantsHtml,
    safeNextPath
};
