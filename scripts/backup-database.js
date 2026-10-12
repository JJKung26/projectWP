const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const source = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = 'restaurant-' + timestamp + '-' + randomUUID().slice(0, 8) + '.db';
const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups', filename));
fs.mkdirSync(path.dirname(target), { recursive: true });
// VACUUM INTO สำรองภาพฐานข้อมูลที่สอดคล้องกัน รวมข้อมูลที่ยังอยู่ใน WAL
let connection;
try {
  connection = new DatabaseSync(source, { readOnly: true, timeout: 10000 });
  connection.prepare('VACUUM INTO ?').run(target);
  console.log('สำรองฐานข้อมูลแล้ว:', target);
} catch (err) {
  console.error('สำรองไม่สำเร็จ:', err.message);
  process.exitCode = 1;
} finally {
  connection?.close();
}
