const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 10000);
function raw(method, sql, params = []) {
    return new Promise((resolve, reject) => {
        db[method](sql, params, function (err, rows) {
            if (err) reject(err);
            else resolve(method === 'run' ? { changes: this.changes, lastID: this.lastID } : rows);
        });
    });
}
const exec = sql => new Promise((resolve, reject) => db.exec(sql, err => err ? reject(err) : resolve()));
const ready = (async () => {
    await exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    await exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    const columns = [
        ['Employee', 'password_hash', 'TEXT'],
        ['Category', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
        ['MenuItem', 'description', 'TEXT'],
        ['MenuItem', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
        ['MenuItem', 'is_active', 'INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))'],
        ['QueueTicket', 'created_at', 'TEXT'],
        ['DiningSession', 'child_count', 'INTEGER NOT NULL DEFAULT 0'],
        ['DiningSession', 'free_child_count', 'INTEGER NOT NULL DEFAULT 0'],
        ['DiningSession', 'child_price', 'REAL NOT NULL DEFAULT 179.00'],
        ['FoodOrder', 'request_key', 'TEXT'],
        ['FoodOrder', 'request_hash', 'TEXT'],
        ['FoodOrder', 'round_no', 'INTEGER'],
        ['OrderItem', 'item_name_at_order', 'TEXT'],
        ['OrderItem', 'charge_type_at_order', 'TEXT'],
        ['Bill', 'subtotal', 'REAL'],
        ['Bill', 'before_rounding', 'REAL'],
        ['Bill', 'rounding_amount', 'REAL'],
        ['Bill', 'snapshot_json', 'TEXT'],
        ['Payment', 'amount_received', 'REAL'],
        ['Payment', 'change_amount', 'REAL'],
        ['Payment', 'paid_at', 'TEXT']
    ];
    for (const [table, name, type] of columns) {
        const info = await raw('all', 'PRAGMA table_info(' + table + ')');
        if (!info.some(c => c.name === name)) await exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + type);
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
    for (const file of ['seed.sql', 'seed-accounts.sql']) await exec(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    const old = await raw('get', 'SELECT COUNT(*) AS n FROM Employee WHERE password_hash IS NULL');
    if (old.n) throw new Error('บัญชีเก่าไม่มี password_hash: รัน npm run seed:accounts เพื่อกำหนดรหัสผ่าน');
})();
// ทุกคำสั่งใช้คิวเดียวกัน จึงไม่มี request อื่นแทรกใน Transaction ของ connection นี้
const context = new AsyncLocalStorage();
let tail = Promise.resolve();
function exclusive(work) {
    const result = tail.then(() => ready).then(work);
    tail = result.catch(() => {});
    return result;
}
function command(method, sql, params) {
    return context.getStore() ? raw(method, sql, params) : exclusive(() => raw(method, sql, params));
}
async function transaction(work) {
    if (context.getStore()) return work();
    return exclusive(() => context.run(true, async () => {
        await raw('run', 'BEGIN IMMEDIATE');
        try {
            const result = await work();
            await raw('run', 'COMMIT');
            return result;
        } catch (err) {
            await raw('run', 'ROLLBACK');
            throw err;
        }
    }));
}
module.exports = { db, ready, transaction,
    query: (sql, params = []) => command('all', sql, params),
    get: (sql, params = []) => command('get', sql, params),
    run: (sql, params = []) => command('run', sql, params)
};
