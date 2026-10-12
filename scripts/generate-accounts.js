// สร้าง database/seed-accounts.sql พร้อม bcrypt hash
// รันใหม่เมื่อต้องการเปลี่ยนรหัสผ่าน: npm run seed:accounts
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
// บัญชีเริ่มต้นสำหรับการสาธิต
const ACCOUNTS = [
  ['EMP-000', 'admin', 'admin123', 'ผู้ดูแลระบบ', 'ADMIN'],
  ['EMP-001', 'cashier1', 'cashier123', 'แคชเชียร์ สมศรี', 'CASHIER'],
  ['EMP-002', 'kitchen1', 'kitchen123', 'เชฟ สมชาย (ครัว)', 'KITCHEN'],
  ['EMP-003', 'service1', 'service123', 'พนักงานเสิร์ฟ นพ', 'SERVICE'],
  ['EMP-004', 'service2', 'service123', 'พนักงานเสิร์ฟ ฝน', 'SERVICE'],
  ['EMP-005', 'cashier2', 'cashier123', 'แคชเชียร์ สมหญิง', 'CASHIER'],
  ['EMP-006', 'kitchen2', 'kitchen123', 'เชฟ มานะ (ครัว)', 'KITCHEN']
];
const rows = ACCOUNTS.map(([id, username, password, fullName, role]) => {
  const hash = bcrypt.hashSync(password, 10);
  return `('${id}', '${username}', '${hash}', '${fullName}', '${role}')`;
}).join(',\n');
const sql = `-- สร้างอัตโนมัติด้วย npm run seed:accounts — ห้ามแก้ไฟล์นี้ด้วยมือ
-- รหัสผ่านเริ่มต้นดูได้ที่ scripts/generate-accounts.js

INSERT INTO Employee (employee_id, username, password_hash, full_name, role) VALUES
${rows}
ON CONFLICT(employee_id) DO UPDATE SET username=excluded.username, password_hash=excluded.password_hash, full_name=excluded.full_name, role=excluded.role;
`;
const outPath = path.join(__dirname, '..', 'database', 'seed-accounts.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('เขียน', outPath, 'เรียบร้อย —', ACCOUNTS.length, 'บัญชี');
const { DatabaseSync } = require('node:sqlite');
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
let connection;
try {
  connection = new DatabaseSync(dbPath, { timeout: 10000 });
  const columns = connection.prepare('PRAGMA table_info(Employee)').all();
  if (!columns.length) {
    connection.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
  } else if (!columns.some((c) => c.name === 'password_hash')) {
    connection.exec('ALTER TABLE Employee ADD COLUMN password_hash TEXT');
  }
  connection.exec(sql);
  console.log('อัปเดตรหัสผ่านบัญชีเดิมในฐานข้อมูลแล้ว');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  connection?.close();
}
