// ทดสอบลูกค้า 60 คนผ่าน Cloudflare ใช้ฐานข้อมูลชั่วคราวแยกจากร้าน
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const https = require('https');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('crypto');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3');
const { io } = require('socket.io-client');

const root = path.join(__dirname, '..');
const provider = 'cloudflare';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), `moo-${provider}-compare-`));
const defaultAgent = new https.Agent({ keepAlive: true, maxSockets: 128 });
const databasePath = path.join(directory, 'test.db');
const clients = 60,
  tableCount = 20,
  rounds = 10,
  port = 3215;
const loadAssets = !process.argv.includes('--orders-only');
const requests = [],
  sockets = [],
  failures = [];
let cloud,
  server,
  database,
  publicUrl,
  devices = [];
const report = {
  provider,
  transport: 'HTTPS/1.1, separate keep-alive agent per simulated customer',
  clients,
  tableCount,
  rounds,
  loadAssets,
  databasePath,
  startedAt: new Date().toISOString()
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(route, body, cookie = '', label = 'other', agent = defaultAgent) {
  const started = performance.now();
  const record = { label, route, status: 0, bytes: 0 };
  const timeout = ['first-screen-asset', 'menu', 'qr-entry', 'staff-page'].includes(label)
    ? 60000
    : 12000;
  try {
    const result = await new Promise((resolve, reject) => {
      const encoded = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const req = https.request(
        publicUrl + route,
        {
          method: encoded ? 'POST' : 'GET',
          agent,
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
            ...(encoded ? { 'Content-Length': encoded.length } : {})
          }
        },
        (response) => {
          record.ttfbMs = performance.now() - started;
          const chunks = [];
          response.on('data', (chunk) => {
            record.bytes += chunk.length;
            chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const headers = new Headers();
            for (let i = 0; i < response.rawHeaders.length; i += 2) {
              headers.append(response.rawHeaders[i], response.rawHeaders[i + 1]);
            }
            let data;
            if (label === 'first-screen-asset') {
              data = { bytes: record.bytes };
            } else {
              const text = buffer.toString('utf8');
              try {
                data = JSON.parse(text);
              } catch {
                data = text;
              }
            }
            resolve({ status: response.statusCode, data, headers });
          });
        }
      );
      const timer = setTimeout(() => req.destroy(Error(`Request exceeded ${timeout} ms`)), timeout);
      req.on('error', reject);
      req.on('close', () => clearTimeout(timer));
      if (encoded) {
        req.write(encoded);
      }
      req.end();
    });
    record.status = result.status;
    return result;
  } catch (error) {
    record.error = error.code || error.message;
    throw error;
  } finally {
    record.ms = performance.now() - started;
    requests.push(record);
  }
}
async function login(username, password) {
  const result = await request('/login', { username, password }, '', 'login');
  assert.equal(result.status, 302);
  return result.headers.get('set-cookie').split(';')[0];
}
async function connect(auth, cookie = '') {
  const socket = io(publicUrl, {
    auth,
    extraHeaders: { Cookie: cookie },
    reconnection: false,
    timeout: 15000,
    autoConnect: false
  });
  sockets.push(socket);
  await reconnect(socket);
  return socket;
}
async function reconnect(socket) {
  await new Promise((resolve, reject) => {
    const connected = () => {
      socket.off('connect_error', rejected);
      resolve();
    };
    const rejected = (error) => {
      socket.off('connect', connected);
      reject(error);
    };
    socket.once('connect', connected);
    socket.once('connect_error', rejected);
    socket.connect();
  });
}
function query(sql, params = []) {
  return new Promise((resolve, reject) =>
    database.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)))
  );
}
function stats(rows) {
  const times = rows.map((row) => row.ms).sort((a, b) => a - b);
  const percentile = (value) => Math.round(times[Math.ceil(times.length * value) - 1] || 0);
  return {
    count: times.length,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: Math.round(times.at(-1) || 0)
  };
}
async function waitFor(check) {
  const deadline = Date.now() + 15000;
  while (!check() && Date.now() < deadline) {
    await delay(100);
  }
  return check();
}
async function batch(tasks) {
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length) {
    failures.push(...rejected.map((result) => result.reason.message));
    throw Error(`${rejected.length} simulated clients failed: ${rejected[0].reason.message}`);
  }
  return results.map((result) => result.value);
}

// ส่ง agent ของลูกค้าให้ request โดยตรง ไม่ต้องใช้ context ซ้อนหลายชั้น
async function visitMenu(device) {
  const landing = await request(
    '/qr/' + device.session.qr_token,
    undefined,
    '',
    'qr-entry',
    device.agent
  );
  assert.equal(landing.status, 302);
  assert.equal(landing.headers.get('location'), '/menu?token=' + device.session.qr_token);
  const result = await request(
    '/menu?token=' + device.session.qr_token,
    undefined,
    '',
    'menu',
    device.agent
  );
  assert.equal(result.status, 200);
  assert.ok(result.data.includes('หมูสามชั้นสไลด์'));
  const assets = [];
  for (const match of result.data.matchAll(/<link[^>]*href="(\/css\/[^"]+)"/g)) {
    assets.push(match[1]);
  }
  for (const match of result.data.matchAll(/<script[^>]*src="(\/[^"]+)"/g)) {
    assets.push(match[1]);
  }
  assets.push('/images/hero.jpg');
  const images = [...result.data.matchAll(/<img[^>]*src="(\/images\/[^"]+)"/g)].slice(0, 4);
  for (const match of images) {
    assets.push(match[1]);
  }
  device.assets = [...new Set(assets)];
}

async function loadFirstScreen(device) {
  for (let index = 0; index < device.assets.length; index += 2) {
    // รอทั้งคู่จบก่อน เพื่อไม่ทิ้งคำขอค้างไปช่วงทดสอบสั่งอาหาร
    const pair = await Promise.allSettled(
      device.assets.slice(index, index + 2).map(async (asset) => {
        const result = await request(asset, undefined, '', 'first-screen-asset', device.agent);
        assert.equal(result.status, 200);
        const file = path.join(root, 'public', asset.split('?')[0]);
        if (fs.existsSync(file)) {
          assert.equal(result.data.bytes, fs.statSync(file).size);
        } else {
          assert.ok(result.data.bytes > 0);
        }
      })
    );
    const error = pair.find((result) => result.status === 'rejected');
    if (error) {
      throw error.reason;
    }
  }
}

async function placeOrder(device) {
  const route = '/orders?token=' + device.session.qr_token;
  const body = {
    request_key: randomUUID(),
    items: [
      { menu_item_id: 'ITEM-101', quantity: 2 },
      { menu_item_id: 'ITEM-103', quantity: 1 },
      { menu_item_id: 'ITEM-108', quantity: 1 }
    ]
  };
  // ส่งคำขอเดียวกันสองครั้งพร้อมกัน เพื่อทดสอบกดซ้ำ/ลองใหม่
  const results = await Promise.all([
    request(route, body, '', 'order', device.agent),
    request(route, body, '', 'order', device.agent)
  ]);
  results.forEach((result) => assert.equal(result.status, 200));
  assert.equal(results[0].data.order_id, results[1].data.order_id);
  assert.equal(results.filter((result) => !result.data.replay).length, 1);
  device.orders.add(results[0].data.order_id);
  const status = await request(route, undefined, '', 'order-status', device.agent);
  assert.equal(status.status, 200);
  assert.ok(status.data.includes('หมูสามชั้นสไลด์'));
}

async function refreshMenu(device, availability) {
  const result = await request(
    '/menu/data?token=' + device.session.qr_token,
    undefined,
    '',
    'stock-refresh',
    device.agent
  );
  assert.equal(result.status, 200);
  assert.equal(
    result.data.menuItems.find((item) => item.menu_item_id === 'ITEM-101').availability,
    availability
  );
}

async function main() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
  const tunnelLog = fs.createWriteStream(path.join(directory, provider + '.log'));
  const serverLog = fs.createWriteStream(path.join(directory, 'server.log'));
  function startServer(url) {
    server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      windowsHide: true,
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: databasePath,
        SESSION_SECRET: randomBytes(32).toString('hex'),
        PUBLIC_URL: url
      }
    });
    server.stdout.pipe(serverLog);
    server.stderr.pipe(serverLog, { end: false });
    return server;
  }
  cloud = spawn(
    path.join(root, 'tools/cloudflared.exe'),
    ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`],
    { cwd: root, windowsHide: true }
  );
  const tunnelProcess = cloud;
  publicUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error(provider + ' startup timed out')), 60000);
    const read = (data) => {
      tunnelLog.write(data);
      output = (output + data).slice(-8192);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    tunnelProcess.stdout.on('data', read);
    tunnelProcess.stderr.on('data', read);
    tunnelProcess.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    tunnelProcess.once('exit', (code) => {
      clearTimeout(timer);
      reject(Error(`Tunnel exited: ${code}`));
    });
  });
  report.publicUrl = publicUrl;
  startServer(publicUrl);
  console.log(`Isolated test URL: ${publicUrl}`);
  // URL อาจแสดงก่อน DNS พร้อม เวลาส่วนนี้ไม่นับเป็นความเร็วการสั่งอาหาร
  const readyDeadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < readyDeadline && !ready) {
    await delay(2000);
    try {
      ready = (await request('/login', undefined, '', 'startup')).status === 200;
    } catch (error) {
      console.log('Waiting for public URL:', error.cause?.code || error.message);
    }
  }
  if (!ready) {
    throw Error('Public test URL was not reachable within 60 seconds');
  }
  const cashier = await login('cashier1', 'cashier123');
  const kitchen = await login('kitchen1', 'kitchen123');
  const service = await login('service1', 'service123');
  const sessions = await batch(
    Array.from({ length: tableCount }, async (_, index) => {
      const result = await request(
        '/cashier/open-table',
        {
          table_id: 'TBL-' + String(index + 1).padStart(2, '0'),
          guest_count: 3,
          buffet_price: 279
        },
        cashier,
        'open-table'
      );
      assert.equal(result.status, 200);
      assert.ok(result.data.customer_url.startsWith(publicUrl));
      return result.data;
    })
  );
  devices = Array.from({ length: clients }, (_, index) => ({
    index,
    session: sessions[Math.floor(index / 3)],
    orders: new Set(),
    events: new Set(),
    stock: [],
    agent: new https.Agent({ keepAlive: true, maxSockets: 6 })
  }));
  await batch(devices.map(visitMenu));
  if (loadAssets) {
    const assetStart = performance.now();
    const loaded = await Promise.allSettled(devices.map(loadFirstScreen));
    report.coldPages = {
      completedClients: loaded.filter((result) => result.status === 'fulfilled').length,
      failedClients: loaded.filter((result) => result.status === 'rejected').length,
      durationSeconds: Number(((performance.now() - assetStart) / 1000).toFixed(2))
    };
    console.log('Cold page assets:', JSON.stringify(report.coldPages));
  }
  const customerConnections = await Promise.allSettled(
    devices.map(async (device) => {
      const socket = await connect({ token: device.session.qr_token });
      device.socket = socket;
      socket.on('new-order', (data) => {
        if (data.session_id !== device.session.session_id) {
          failures.push('Event leaked to another table');
        }
        device.events.add(data.order_id);
      });
      socket.on('stock-updated', (data) => device.stock.push(data.availability));
    })
  );
  const staffConnections = await Promise.allSettled([
    connect({ role: 'KITCHEN' }, kitchen),
    connect({ role: 'KITCHEN' }, kitchen),
    connect({ role: 'SERVICE' }, service),
    connect({ role: 'CASHIER' }, cashier)
  ]);
  const staff = staffConnections
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  report.connectionErrors = [...customerConnections, ...staffConnections]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason.message);
  const staffOrders = staff.map(() => new Set());
  staff.forEach((socket, index) =>
    socket.on('new-order', (data) => staffOrders[index].add(data.order_id))
  );
  console.log(
    `${devices.filter((device) => device.socket).length} customers + ${staff.length} staff Socket.IO connected; starting ${rounds} bursts.`
  );
  const burstStart = performance.now();
  for (let round = 0; round < rounds; round++) {
    if (round === 5) {
      devices.slice(0, 10).forEach((device) => device.socket?.disconnect());
    }
    await batch(devices.map(placeOrder));
    if (round === 5) {
      await batch(
        devices
          .slice(0, 10)
          .filter((device) => device.socket)
          .map((device) => reconnect(device.socket))
      );
    }
    console.log(
      `Burst ${round + 1}/${rounds}: ${(round + 1) * clients} unique orders, duplicate requests matched.`
    );
  }
  report.burstDurationSeconds = Number(((performance.now() - burstStart) / 1000).toFixed(2));
  const expectedOrders = clients * rounds;
  report.orderEventsPassed =
    !report.connectionErrors.length &&
    (await waitFor(
      () =>
        staffOrders.every((events) => events.size === expectedOrders) &&
        devices.every((device) => device.events.size === rounds * 3 - (device.index < 10 ? 3 : 0))
    ));
  devices.forEach((device) => assert.equal(device.orders.size, rounds));
  for (const availability of [0, 1]) {
    assert.equal(
      (
        await request(
          '/kitchen/toggle-stock',
          { menu_item_id: 'ITEM-101', availability },
          kitchen,
          'stock'
        )
      ).status,
      200
    );
    await batch(devices.map((device) => refreshMenu(device, availability)));
  }
  report.stockEventsPassed =
    !report.connectionErrors.length &&
    (await waitFor(() => devices.every((device) => JSON.stringify(device.stock) === '[0,1]')));
  for (const [route, cookie] of [
    ['/kitchen', kitchen],
    ['/serving', service],
    ['/cashier/tables', cashier]
  ]) {
    assert.equal((await request(route, undefined, cookie, 'staff-page')).status, 200);
  }
  database = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY);
  const counts = (
    await query(`SELECT (SELECT COUNT(*) FROM DiningSession) sessions,
        (SELECT COUNT(*) FROM FoodOrder) orders, (SELECT COUNT(*) FROM OrderItem) items,
        (SELECT SUM(quantity) FROM OrderItem) quantity, (SELECT COUNT(*) FROM Bill) bills,
        (SELECT COUNT(*) FROM Payment) payments`)
  )[0];
  assert.deepEqual(counts, {
    sessions: tableCount,
    orders: expectedOrders,
    items: expectedOrders * 3,
    quantity: expectedOrders * 4,
    bills: 0,
    payments: 0
  });
  const grouped = await query(
    'SELECT session_id,COUNT(*) n,COUNT(DISTINCT round_no) rounds FROM FoodOrder GROUP BY session_id'
  );
  assert.equal(grouped.length, tableCount);
  grouped.forEach((row) => {
    assert.equal(row.n, rounds * 3);
    assert.equal(row.rounds, rounds * 3);
  });
  assert.equal((await query('PRAGMA foreign_key_check')).length, 0);
  assert.equal((await query('PRAGMA integrity_check'))[0].integrity_check, 'ok');
  const stored = new Set(
    (await query('SELECT order_id FROM FoodOrder')).map((row) => row.order_id)
  );
  devices.forEach((device) => device.orders.forEach((id) => assert.ok(stored.has(id))));
  report.databaseCounts = counts;
  report.realtime = {
    customerConnections: devices.filter((device) => device.socket?.connected).length,
    staffConnections: staff.length,
    transports: Object.fromEntries(
      ['polling', 'websocket'].map((name) => [
        name,
        sockets.filter((socket) => socket.connected && socket.io.engine?.transport.name === name)
          .length
      ])
    ),
    staffOrderEventsPerConnection: staffOrders.map((events) => events.size),
    reconnectedCustomers: devices.slice(0, 10).filter((device) => device.socket).length,
    stockUpdatesVerified: report.stockEventsPassed,
    wrongTableEvents: failures.length
  };
  assert.equal(failures.length, 0);
  report.ordersPassed = true;
  report.passed =
    (!loadAssets || report.coldPages.failedClients === 0) &&
    report.orderEventsPassed &&
    report.stockEventsPassed;
  if (!report.passed) {
    process.exitCode = 1;
  }
}

function cleanup() {
  sockets.forEach((socket) => socket.disconnect());
  server?.kill();
  cloud?.kill();
  devices.forEach((device) => device.agent.destroy());
  defaultAgent.destroy();
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
main()
  .catch((error) => {
    report.passed = false;
    report.error = error.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    if (database) {
      await new Promise((resolve) => database.close(resolve));
    }
    cleanup();
    report.finishedAt = new Date().toISOString();
    report.startupChecks = requests.filter((row) => row.label === 'startup');
    const workload = requests.filter((row) => row.label !== 'startup');
    report.http = {
      ...stats(workload),
      errors: workload.filter((row) => row.status === 0 || row.status >= 400).length
    };
    report.orderRequests = stats(requests.filter((row) => row.label === 'order'));
    report.coldPageAssets = {
      ...stats(requests.filter((row) => row.label === 'first-screen-asset')),
      totalBytes: requests
        .filter((row) => row.label === 'first-screen-asset')
        .reduce((sum, row) => sum + (row.bytes || 0), 0)
    };
    report.byLabel = Object.fromEntries(
      [...new Set(requests.map((row) => row.label))].map((label) => [
        label,
        stats(requests.filter((row) => row.label === label))
      ])
    );
    report.failures = failures;
    report.failedRequests = workload.filter((row) => row.status === 0 || row.status >= 400);
    const resultPath = path.join(
      root,
      loadAssets ? 'cloudflare-load-results.json' : 'cloudflare-load-orders-only.json'
    );
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(directory, 'http-results.json'), JSON.stringify(requests, null, 2));
    console.log(
      JSON.stringify(
        {
          provider,
          passed: report.passed,
          ordersPassed: report.ordersPassed,
          coldPages: report.coldPages,
          orderRequests: report.orderRequests,
          http: report.http,
          error: report.error
        },
        null,
        2
      )
    );
    console.log(`Report saved: ${resultPath}`);
    // ปิด long polling ที่ค้างหลัง teardown ไม่ปล่อย client ทดสอบรันต่อ
    setImmediate(() => process.exit(process.exitCode || 0));
  });
