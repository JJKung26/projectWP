const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

// ทดสอบด้วยฐานข้อมูลชั่วคราว ไม่แก้ข้อมูลร้านที่ใช้งานจริง
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mookata-isad-'));
process.env.DB_PATH = path.join(directory, 'test.db');
const db = require('../database/database');
const { app } = require('../server');
const { requireRole } = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');
let server;
let base;
const cookies = {};
const roles = [
  ['CASHIER', '/cashier/tables', 'cashier', 'cashier123'],
  ['KITCHEN', '/kitchen', 'kitchen', 'kitchen123'],
  ['SERVICE', '/serving', 'service', 'service123']
];

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  db.db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

function request(url, options = {}) {
  return fetch(base + url, { redirect: 'manual', ...options });
}
function post(url, body, cookie = '') {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: cookie },
    body: JSON.stringify(body)
  });
}

test('ฐานข้อมูลใหม่มีเฉพาะพนักงาน 3 หน้าที่ จำนวน 6 บัญชี', () => {
  assert.equal(db.get('SELECT COUNT(*) AS total FROM Employee').total, 6);
  assert.deepEqual(
    db.query('SELECT DISTINCT role FROM Employee ORDER BY role').map(row => row.role),
    ['CASHIER', 'KITCHEN', 'SERVICE']
  );
  assert.throws(() => db.run(
    'INSERT INTO Employee VALUES (?, ?, ?, ?, ?)',
    ['EMP-X', 'unsupported', 'hash', 'Unsupported', 'ADMIN']
  ), /CHECK constraint failed/);
});

test('พนักงานทั้ง 6 บัญชีเข้าหน้าตนเองได้ และเข้าอีกหน้าที่ไม่ได้', async () => {
  for (const [role, home, username, password] of roles) {
    for (const number of [1, 2]) {
      const login = await post('/login', { username: username + number, password });
      assert.equal(login.status, 302);
      assert.equal(login.headers.get('location'), home);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      assert.ok(cookie.startsWith('staff_' + role + '='));
      if (number === 1) cookies[role] = cookie;
      for (const [other, url] of roles) {
        const page = await request(url, { headers: { Cookie: cookie, Accept: 'text/html' } });
        if (other === role) {
          assert.equal(page.status, 200);
          const html = await page.text();
          const nav = html.match(/<nav class="nav-links row">([\s\S]*?)<\/nav>/)[1];
          assert.equal((nav.match(/class="nav-link row"/g) || []).length, 1);
          assert.ok(nav.includes('href="' + home + '"'));
        } else {
          assert.equal(page.status, 302);
          assert.equal(page.headers.get('location'), '/login');
        }
      }
    }
  }
});

test('คำสั่งเปลี่ยนข้อมูลปฏิเสธผู้ไม่ล็อกอินและพนักงานต่างหน้าที่', async () => {
  const actions = [
    ['CASHIER', '/cashier/open-table'],
    ['CASHIER', '/cashier/payment'],
    ['CASHIER', '/cashier/queue/issue'],
    ['KITCHEN', '/kitchen/update-status'],
    ['KITCHEN', '/kitchen/toggle-stock'],
    ['SERVICE', '/serving/confirm-served']
  ];
  for (const [owner, url] of actions) {
    assert.equal((await post(url, {})).status, 401);
    for (const [role] of roles) {
      if (role !== owner) assert.equal((await post(url, {}, cookies[role])).status, 401);
    }
  }
});

test('บัญชีและคุกกี้ Admin เก่าใช้เข้าเว็บหรือข้ามหน้าที่ไม่ได้', async () => {
  // จำลองแถวที่ค้างอยู่ในฐานข้อมูลจากเวอร์ชันเดิมก่อนเปลี่ยนสาขา
  db.db.exec('PRAGMA ignore_check_constraints = ON');
  db.run('INSERT INTO Employee VALUES (?, ?, ?, ?, ?)', [
    'EMP-000', 'admin', bcrypt.hashSync('admin123', 4), 'Legacy staff', 'ADMIN'
  ]);
  db.db.exec('PRAGMA ignore_check_constraints = OFF');
  const response = await post('/login', { username: 'admin', password: 'admin123' });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
  for (const [role] of roles) {
    for (const signedCookies of [
      { staff_ADMIN: 'EMP-000' },
      { ['staff_' + role]: 'EMP-000' },
      { ['staff_' + role]: 'EMP-001' }
    ]) {
      // บัญชีแคชเชียร์ยังใช้เฉพาะหน้าที่แคชเชียร์ได้
      if (signedCookies['staff_' + role] === 'EMP-001' && role === 'CASHIER') continue;
      let status;
      let allowed = false;
      const res = { locals: {}, status(code) { status = code; return this; }, json() {} };
      requireRole(role)({ signedCookies, get: () => 'application/json' }, res, () => { allowed = true; });
      assert.equal(allowed, false);
      assert.equal(status, 401);
    }
  }
  // ไม่ลบแถวประวัติเดิมที่อาจถูกอ้างอิงในรอบบริการหรือใบเสร็จ
  assert.equal(db.get('SELECT employee_id FROM Employee WHERE username = ?', ['admin']).employee_id, 'EMP-000');
});

test('คิว เปิดโต๊ะ สั่งอาหาร ครัว เสิร์ฟ รับเงิน และออกใบเสร็จยังทำงานครบ', async () => {
  const issued = await post('/cashier/queue/issue', { guest_count: 2 }, cookies.CASHIER);
  assert.equal(issued.status, 200);
  const { ticket } = await issued.json();
  const opened = await post('/cashier/open-table', {
    table_id: 'TBL-01', adult_count: 2, child_count: 0, free_child_count: 0,
    buffet_price: 279, child_price: 179, queue_ticket_id: ticket.queue_ticket_id
  }, cookies.CASHIER);
  assert.equal(opened.status, 200);
  const session = await opened.json();
  assert.ok(session.qr_image.startsWith('data:image/png;base64,'));
  assert.equal(db.get('SELECT queue_status FROM QueueTicket WHERE queue_ticket_id = ?', [ticket.queue_ticket_id]).queue_status, 'SEATED');
  const token = session.qr_token;
  const menuPage = await request('/menu?token=' + token);
  assert.equal(menuPage.status, 200);
  const menu = db.get('SELECT menu_item_id FROM MenuItem WHERE is_active = 1 AND availability = 1');
  const ordered = await post('/orders', {
    token, request_key: 'isad-workflow', items: [{ menu_item_id: menu.menu_item_id, quantity: 2 }]
  });
  assert.equal(ordered.status, 200);
  const { order_id } = await ordered.json();
  for (const status of ['COOKING', 'READY']) {
    const changed = await post('/kitchen/update-status', { order_id, status }, cookies.KITCHEN);
    assert.equal(changed.status, 200);
  }
  assert.equal((await request('/serving', { headers: { Cookie: cookies.SERVICE } })).status, 200);
  assert.equal((await post('/serving/confirm-served', { order_id }, cookies.SERVICE)).status, 200);
  const item = db.get('SELECT * FROM OrderItem WHERE order_id = ?', [order_id]);
  assert.equal(item.item_status, 'SERVED');
  assert.equal(item.prepared_by, 'EMP-002');
  assert.equal(item.served_by, 'EMP-003');
  const { totals, itemsFor } = require('../utils/billing');
  const amount = totals(session, itemsFor(session.session_id)).netAmount;
  const payment = await post('/cashier/payment', {
    session_id: session.session_id, payment_method: 'CASH',
    expected_total: amount, amount_received: amount + 100
  }, cookies.CASHIER);
  assert.equal(payment.status, 200);
  const paid = await payment.json();
  assert.equal((await request(paid.receipt_url, { headers: { Cookie: cookies.CASHIER } })).status, 200);
  assert.equal(db.get('SELECT table_status FROM DiningTable WHERE table_id = ?', ['TBL-01']).table_status, 'AVAILABLE');
  assert.equal(db.get('SELECT received_by FROM Payment').received_by, 'EMP-001');
  assert.equal((await request('/menu?token=' + token)).status, 400);
  const logout = await post('/logout', { role: 'CASHIER' }, cookies.CASHIER);
  assert.equal(logout.status, 302);
  const cleared = logout.headers.get('set-cookie');
  assert.ok(cleared.startsWith('staff_CASHIER='));
  const expires = cleared.match(/Expires=([^;]+)/)[1];
  assert.ok(Date.parse(expires) < Date.now());
  const loggedOut = await request('/cashier/tables', {
    headers: { Cookie: cleared.split(';')[0], Accept: 'text/html' }
  });
  assert.equal(loggedOut.status, 302);
  assert.equal(loggedOut.headers.get('location'), '/login');
});
