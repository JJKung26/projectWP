const test = require('node:test');
const assert = require('node:assert');
const requireRole = require('../middlewares/auth.middleware').requireRole;
const database = require('../database/database');
const { cookieNameFor } = require('../middlewares/auth.helpers');

function fakeRes() {
    return {
        locals: {},
        statusCode: null,
        jsonBody: null,
        redirectedTo: null,
        renderedView: null,
        renderedData: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.jsonBody = body; return this; },
        redirect(url) { this.redirectedTo = url; return this; },
        render(view, data) { this.renderedView = view; this.renderedData = data; return this; }
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

test('db.get() reject + มาจาก fetch() → ตอบ 500 JSON ภาษาไทย ไม่ throw ขึ้นไป', async () => {
    const originalGet = database.get;
    database.get = () => Promise.reject(new Error('DB ปิดอยู่ (จำลองสำหรับเทสต์)'));
    try {
        const res = fakeRes();
        let nextCalled = false;
        const req = fakeReq({ accept: '*/*', url: '/kitchen/update-status' });
        req.signedCookies = { [cookieNameFor('KITCHEN')]: 'EMP-002' };

        await assert.doesNotReject(
            requireRole('KITCHEN')(req, res, () => { nextCalled = true; })
        );

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.redirectedTo, null);
        assert.strictEqual(res.renderedView, null);
        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.jsonBody.success, false);
        assert.ok(res.jsonBody.message.length > 0);
        assert.ok(/[ก-๙]/.test(res.jsonBody.message)); // ต้องเป็นภาษาไทย
    } finally {
        database.get = originalGet;
    }
});

test('db.get() reject + เปิดหน้าเว็บ → ตอบ 500 ด้วยหน้า error ไม่ใช่ redirect', async () => {
    const originalGet = database.get;
    database.get = () => Promise.reject(new Error('DB ปิดอยู่ (จำลองสำหรับเทสต์)'));
    try {
        const res = fakeRes();
        let nextCalled = false;
        const req = fakeReq({ accept: 'text/html', url: '/kitchen' });
        req.signedCookies = { [cookieNameFor('KITCHEN')]: 'EMP-002' };

        await assert.doesNotReject(
            requireRole('KITCHEN')(req, res, () => { nextCalled = true; })
        );

        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.redirectedTo, null);
        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.renderedView, 'error');
        assert.ok(res.renderedData.message.length > 0);
        assert.ok(/[ก-๙]/.test(res.renderedData.message));
    } finally {
        database.get = originalGet;
    }
});
