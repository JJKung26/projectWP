const test = require('node:test');
const assert = require('node:assert');
const requireRole = require('../middlewares/auth.middleware').requireRole;

function fakeRes() {
    return {
        locals: {},
        statusCode: null,
        jsonBody: null,
        redirectedTo: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.jsonBody = body; return this; },
        redirect(url) { this.redirectedTo = url; return this; }
    };
}

function fakeReq({ accept, url = '/kitchen' }) {
    return {
        get: () => accept,
        signedCookies: {},
        originalUrl: url
    };
}

test('ไม่มี cookie + เปิดหน้าเว็บ → เด้งไปหน้า login พร้อม next', async () => {
    const res = fakeRes();
    let nextCalled = false;
    await requireRole('KITCHEN')(
        fakeReq({ accept: 'text/html', url: '/kitchen' }),
        res,
        () => { nextCalled = true; }
    );
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.redirectedTo, '/login?next=' + encodeURIComponent('/kitchen'));
});

test('ไม่มี cookie + มาจาก fetch() → ตอบ 401 JSON ไม่ใช่ HTML', async () => {
    const res = fakeRes();
    let nextCalled = false;
    await requireRole('KITCHEN')(
        fakeReq({ accept: '*/*', url: '/kitchen/update-status' }),
        res,
        () => { nextCalled = true; }
    );
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.redirectedTo, null);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonBody.success, false);
    assert.ok(res.jsonBody.message.length > 0);
});

test('ไม่มี signedCookies เลย ก็ต้องไม่ throw', async () => {
    const res = fakeRes();
    const req = { get: () => '*/*', originalUrl: '/serving' };
    await requireRole('SERVICE')(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
});
