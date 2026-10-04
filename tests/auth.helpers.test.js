const test = require('node:test');
const assert = require('node:assert');
const {
    ROLES, COOKIE_PREFIX, COOKIE_OPTIONS, HOME_BY_ROLE,
    cookieNameFor, wantsHtml, safeNextPath
} = require('../middlewares/auth.helpers');

// จำลอง req แบบง่าย — ของจริง Express มี req.get() ให้
const reqWithAccept = (accept) => ({ get: () => accept });

test('cookieNameFor ประกอบชื่อ cookie ตาม role', () => {
    assert.strictEqual(cookieNameFor('KITCHEN'), 'staff_KITCHEN');
    assert.strictEqual(cookieNameFor('ADMIN'), 'staff_ADMIN');
});

test('ชื่อ cookie ของแต่ละ role ต้องไม่ซ้ำกัน เพื่อให้ล็อกอินพร้อมกันได้', () => {
    const names = ROLES.map(cookieNameFor);
    assert.strictEqual(new Set(names).size, ROLES.length);
});

test('ทุก role ต้องมีหน้าแรกกำหนดไว้', () => {
    for (const role of ROLES) {
        assert.ok(HOME_BY_ROLE[role], `role ${role} ไม่มีหน้าแรก`);
        assert.ok(HOME_BY_ROLE[role].startsWith('/'));
    }
});

test('COOKIE_OPTIONS ต้องเซ็นชื่อ ปิด JS และไม่บังคับ https', () => {
    assert.strictEqual(COOKIE_OPTIONS.signed, true);
    assert.strictEqual(COOKIE_OPTIONS.httpOnly, true);
    // ต้องเป็น false เพราะตอนตรวจงานรันบน http://localhost
    assert.strictEqual(COOKIE_OPTIONS.secure, false);
});

test('wantsHtml เป็น true เมื่อเปิดหน้าเว็บจาก address bar', () => {
    assert.strictEqual(wantsHtml(reqWithAccept('text/html,application/xhtml+xml,*/*;q=0.8')), true);
});

test('wantsHtml เป็น false เมื่อมาจาก fetch()', () => {
    assert.strictEqual(wantsHtml(reqWithAccept('*/*')), false);
    assert.strictEqual(wantsHtml(reqWithAccept('application/json')), false);
});

test('wantsHtml ไม่พังเมื่อไม่มี header Accept', () => {
    assert.strictEqual(wantsHtml({ get: () => undefined }), false);
});

test('safeNextPath ยอมรับ path ภายในเว็บ', () => {
    assert.strictEqual(safeNextPath('/kitchen'), '/kitchen');
    assert.strictEqual(safeNextPath('/cashier/bill/SES-1'), '/cashier/bill/SES-1');
});

test('safeNextPath ปฏิเสธลิงก์ออกนอกเว็บ (กัน open redirect)', () => {
    assert.strictEqual(safeNextPath('https://evil.com'), null);
    assert.strictEqual(safeNextPath('//evil.com'), null);
    assert.strictEqual(safeNextPath('http://evil.com/x'), null);
});

test('safeNextPath ปฏิเสธ backslash ที่เบราว์เซอร์อาจตีความเป็น slash', () => {
    assert.strictEqual(safeNextPath('/\\evil.com'), null);
    assert.strictEqual(safeNextPath('/\\\\evil.com'), null);
});

test('safeNextPath ปฏิเสธค่าที่ไม่ใช่ข้อความหรือว่างเปล่า', () => {
    assert.strictEqual(safeNextPath(undefined), null);
    assert.strictEqual(safeNextPath(''), null);
    assert.strictEqual(safeNextPath(123), null);
    assert.strictEqual(safeNextPath('kitchen'), null);
});
