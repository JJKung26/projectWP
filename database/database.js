const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 10000);

function raw(method, sql, params = []) {
  return new Promise((resolve, reject) => {
    db[method](sql, params, function (err, rows) {
      if (err) {
        return reject(err);
      }
      if (method === 'run') {
        return resolve({ changes: this.changes });
      }
      resolve(rows);
    });
  });
}
const exec = (sql) =>
  new Promise((resolve, reject) => db.exec(sql, (err) => (err ? reject(err) : resolve())));
async function initialize() {
  await exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const columns = {
    Employee: { password_hash: 'TEXT' },
    Category: { sort_order: 'INTEGER NOT NULL DEFAULT 0' },
    MenuItem: {
      description: 'TEXT',
      sort_order: 'INTEGER NOT NULL DEFAULT 0',
      is_active: 'INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))'
    },
    QueueTicket: { created_at: 'TEXT' },
    DiningSession: {
      child_count: 'INTEGER NOT NULL DEFAULT 0',
      free_child_count: 'INTEGER NOT NULL DEFAULT 0',
      child_price: 'REAL NOT NULL DEFAULT 179.00'
    },
    FoodOrder: { request_key: 'TEXT', request_hash: 'TEXT', round_no: 'INTEGER' },
    OrderItem: { item_name_at_order: 'TEXT', charge_type_at_order: 'TEXT' },
    Bill: {
      subtotal: 'REAL',
      before_rounding: 'REAL',
      rounding_amount: 'REAL',
      snapshot_json: 'TEXT'
    },
    Payment: { amount_received: 'REAL', change_amount: 'REAL', paid_at: 'TEXT' }
  };
  // ตรวจคอลัมน์ครั้งเดียวต่อตาราง แล้วเพิ่มเฉพาะช่องที่ยังไม่มี
  for (const table in columns) {
    const info = await raw('all', 'PRAGMA table_info(' + table + ')');
    for (const name in columns[table]) {
      if (!info.some((c) => c.name === name)) {
        await exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + columns[table][name]);
      }
    }
  }
  // หยุด startup หากข้อมูลเก่าซ้ำ แทนการลบข้อมูลลูกค้าเอง
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_session ON DiningSession(table_id) WHERE session_status = 'ACTIVE';
        CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_queue ON QueueTicket(queue_date, queue_no);
        CREATE UNIQUE INDEX IF NOT EXISTS unique_order_request ON FoodOrder(session_id, request_key);
        CREATE UNIQUE INDEX IF NOT EXISTS one_success_payment ON Payment(bill_id) WHERE payment_status = 'SUCCESS';
        CREATE INDEX IF NOT EXISTS orders_by_session ON FoodOrder(session_id);
        CREATE INDEX IF NOT EXISTS items_by_order ON OrderItem(order_id);
        UPDATE FoodOrder SET round_no = (SELECT COUNT(*) FROM FoodOrder f WHERE f.session_id = FoodOrder.session_id AND f.rowid <= FoodOrder.rowid) WHERE round_no IS NULL;
        UPDATE OrderItem SET item_name_at_order = (SELECT item_name FROM MenuItem WHERE menu_item_id = OrderItem.menu_item_id), charge_type_at_order = (SELECT charge_type FROM MenuItem WHERE menu_item_id = OrderItem.menu_item_id) WHERE item_name_at_order IS NULL;`);
  // ย้ายสถานะรอเก็บโต๊ะจากรุ่นเก่า โดยไม่ปล่อยโต๊ะที่ยังมีลูกค้า
  await exec(`UPDATE DiningTable SET table_status = CASE
        WHEN EXISTS (SELECT 1 FROM DiningSession s WHERE s.table_id = DiningTable.table_id AND s.session_status = 'ACTIVE')
        THEN 'OCCUPIED' ELSE 'AVAILABLE' END WHERE table_status = 'CLEANING'`);
  // สร้างเฉพาะโต๊ะที่ยังไม่มี จึงไม่เปลี่ยนโต๊ะหรือรอบบริการเดิม
  for (let number = 1; number <= 50; number++) {
    let capacity = 4;
    if (number === 50) {
      capacity = 10;
    } else if (number % 10 === 0) {
      capacity = 8;
    } else if (number % 5 === 0) {
      capacity = 6;
    }
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
  const old = await raw('get', 'SELECT COUNT(*) AS n FROM Employee WHERE password_hash IS NULL');
  if (old.n) {
    throw new Error('บัญชีเก่าไม่มี password_hash: รัน npm run seed:accounts เพื่อกำหนดรหัสผ่าน');
  }
}
const ready = initialize();
// ทุกคำสั่งใช้คิวเดียวกัน จึงไม่มี request อื่นแทรกใน Transaction ของ connection นี้
let tail = Promise.resolve();

function exclusive(work) {
  const result = tail.then(() => ready).then(work);
  tail = result.catch(() => {});
  return result;
}
const queries = {
  query: (sql, params) => raw('all', sql, params),
  get: (sql, params) => raw('get', sql, params),
  run: (sql, params) => raw('run', sql, params)
};

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
