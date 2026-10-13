// สร้างบัญชีเริ่มต้น 7 บัญชีและเข้ารหัสรหัสผ่าน
// สร้างบัญชีเริ่มต้น: npm run seed:accounts
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');
const ACCOUNTS = [
  ['EMP-000', 'admin', 'admin123', 'ผู้ดูแลระบบ', 'ADMIN'],
  ['EMP-001', 'cashier1', 'cashier123', 'แคชเชียร์ สมศรี', 'CASHIER'],
  ['EMP-002', 'kitchen1', 'kitchen123', 'เชฟ สมชาย (ครัว)', 'KITCHEN'],
  ['EMP-003', 'service1', 'service123', 'พนักงานเสิร์ฟ นพ', 'SERVICE'],
  ['EMP-004', 'service2', 'service123', 'พนักงานเสิร์ฟ ฝน', 'SERVICE'],
  ['EMP-005', 'cashier2', 'cashier123', 'แคชเชียร์ สมหญิง', 'CASHIER'],
  ['EMP-006', 'kitchen2', 'kitchen123', 'เชฟ มานะ (ครัว)', 'KITCHEN']
];
const rows = [];
for (const [id, username, password, fullName, role] of ACCOUNTS) {
  const hash = bcrypt.hashSync(password, 10);
  rows.push(`('${id}', '${username}', '${hash}', '${fullName}', '${role}')`);
}
const sql = `-- สร้างด้วย npm run seed:accounts; รหัสผ่านเริ่มต้นอยู่ใน scripts/generate-accounts.js
INSERT INTO Employee (employee_id, username, password_hash, full_name, role) VALUES
${rows.join(',\n')}
ON CONFLICT(employee_id) DO UPDATE SET username=excluded.username, password_hash=excluded.password_hash, full_name=excluded.full_name, role=excluded.role;
`;
const directory = path.join(__dirname, '..', 'database');
fs.writeFileSync(path.join(directory, 'seed-accounts.sql'), sql, 'utf8');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const connection = new sqlite3.Database(dbPath);
connection.configure('busyTimeout', 10000);
// รันคำสั่งอ่านหรือเพิ่มข้อมูลบัญชีใน SQLite
function query(method, sql) {
  return new Promise(function (resolve, reject) {
    connection[method](sql, function (error, rows) {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}
// เตรียมตารางพนักงานแล้วบันทึกบัญชีและรหัสผ่านเริ่มต้น
async function main() {
  try {
    const columns = await query('all', 'PRAGMA table_info(Employee)');
    if (!columns.length) {
      await query('exec', fs.readFileSync(path.join(directory, 'schema.sql'), 'utf8'));
    } else if (!columns.some((column) => column.name === 'password_hash')) {
      await query('exec', 'ALTER TABLE Employee ADD COLUMN password_hash TEXT');
    }
    await query('exec', sql);
    console.log('อัปเดตบัญชีแล้ว:', ACCOUNTS.length, 'บัญชี');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    connection.close();
  }
}
main();
