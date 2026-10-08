const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'restaurant.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        initDatabase();
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function initDatabase() {
    const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

    db.exec(read('schema.sql'), (err) => {
        if (err) {
            console.error('Error executing schema.sql:', err.message);
            return;
        }
        console.log('Database schema created/verified successfully.');

        guardSchemaVersion((ok) => {
            if (!ok) return;
            migrate(() => {
                db.exec(read('seed.sql') + '\n' + read('seed-accounts.sql'), (err) => {
                    if (err) {
                        console.error('Error seeding database:', err.message);
                        return;
                    }
                    console.log('Database seeded successfully.');
                });
            });
        });
    });
}

// ฐานข้อมูลที่สร้างก่อนมีระบบ login จะไม่มีคอลัมน์ password_hash
function guardSchemaVersion(done) {
    db.all('PRAGMA table_info(Employee)', (err, cols) => {
        if (err) {
            console.error('ตรวจสอบโครงสร้างตาราง Employee ไม่สำเร็จ:', err.message);
            return done(false);
        }
        if (!cols.some(c => c.name === 'password_hash')) {
            console.error('');
            console.error('===============================================================');
            console.error('  ฐานข้อมูลเป็นเวอร์ชันเก่า (ไม่มีคอลัมน์ password_hash)');
            console.error('  หรือลบโฟลเดอร์ data/ ทิ้งแล้วเริ่มเซิร์ฟเวอร์อีกครั้ง');
            console.error('===============================================================');
            console.error('');
            return done(false);
        }
        done(true);
    });
}

// Columns added after the first release. CREATE TABLE IF NOT EXISTS won't add
// them to a database that already exists, so add any that are missing.
const addedColumns = [
    ['Category', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['MenuItem', 'description', 'TEXT']
];

function migrate(done) {
    let pending = addedColumns.length;
    addedColumns.forEach(([table, column, type]) => {
        db.all(`PRAGMA table_info(${table})`, (err, cols) => {
            const finish = () => { if (--pending === 0) done(); };
            if (err || cols.some(c => c.name === column)) return finish();
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
                if (err) console.error(`Error adding ${table}.${column}:`, err.message);
                else console.log(`Added column ${table}.${column}`);
                finish();
            });
        });
    });
}

// Helper promises for async/await usage
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

module.exports = {
    db,
    query,
    get,
    run
};
