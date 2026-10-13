// เปิด SQLite และเตรียมตาราง เมนู บัญชี และโต๊ะเริ่มต้น
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 10000);

// ส่งคำสั่ง SQL แล้วคืนผลเป็น Promise
function raw(method, sql, params = []) {
  return new Promise((resolve, reject) => {
    db[method](sql, params, function (err, rows) {
      if (err) return reject(err);
      if (method === 'run') return resolve({ changes: this.changes });
      resolve(rows);
    });
  });
}
// รันชุดคำสั่ง SQL เช่น สร้างตารางหรือเพิ่มข้อมูลเริ่มต้น
function exec(sql) {
  return new Promise(function (resolve, reject) {
    db.exec(sql, function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}

// เตรียมฐานข้อมูลก่อนให้เว็บรับคำขอ
async function initialize() {
  await exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  // สร้างเฉพาะโต๊ะที่ยังไม่มี จึงไม่เปลี่ยนโต๊ะหรือรอบบริการเดิม
  for (let number = 1; number <= 50; number++) {
    let capacity = 4;
    if (number % 5 === 0) capacity = 6;
    if (number % 10 === 0) capacity = 8;
    if (number === 50) capacity = 10;
    const tableId = 'TBL-' + String(number).padStart(2, '0');
    await raw(
      'run',
      "INSERT OR IGNORE INTO DiningTable (table_id, table_no, capacity, table_status) VALUES (?, ?, ?, 'AVAILABLE')",
      [tableId, String(number), capacity]
    );
  }
  for (const file of ['seed.sql', 'seed-accounts.sql']) {
    await exec(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  }
}
const ready = initialize();
// ทุกคำสั่งใช้คิวเดียวกัน จึงไม่มี request อื่นแทรกใน Transaction ของ connection นี้
let tail = Promise.resolve();

// เรียงงานฐานข้อมูลให้ทำทีละงาน
function exclusive(work) {
  const result = tail.then(async function () {
    await ready;
    return work();
  });
  tail = result.catch(() => {});
  return result;
}
// ใช้ภายใน transaction จึงไม่ต้องเข้าคิวซ้ำ
function insert(table, values) {
  const columns = Object.keys(values);
  const params = Object.values(values);
  const placeholders = columns.map(() => '?');
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders.join(',')})`;
  return raw('run', sql, params);
}
const queries = {
  query(sql, params) {
    return raw('all', sql, params);
  },
  get(sql, params) {
    return raw('get', sql, params);
  },
  run(sql, params) {
    return raw('run', sql, params);
  },
  insert
};

// บันทึกงานทั้งชุด หากผิดพลาดให้ย้อนข้อมูลทั้งชุด
function transaction(work) {
  return exclusive(async () => {
    await raw('run', 'BEGIN IMMEDIATE');
    try {
      const result = await work(queries);
      await raw('run', 'COMMIT');
      return result;
    } catch (err) {
      await raw('run', 'ROLLBACK');
      throw err;
    }
  });
}
module.exports = {
  db,
  ready,
  transaction,
  query: (sql, params) => exclusive(() => queries.query(sql, params)),
  get: (sql, params) => exclusive(() => queries.get(sql, params)),
  run: (sql, params) => exclusive(() => queries.run(sql, params))
};
