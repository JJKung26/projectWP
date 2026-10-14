// SQLite ที่มากับ Node.js 24 ทำงานทีละคำสั่ง จึงอ่านโค้ดจากบนลงล่างได้
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
// เปิดไฟล์ฐานข้อมูลและสร้างตารางตาม schema.sql
const file = process.env.DB_PATH || path.join(__dirname, '../data/restaurant.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// อ่านหลายแถว อ่านหนึ่งแถว หรือบันทึกข้อมูลด้วย SQL
function query(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
// บันทึกทั้งชุด เช่น ออเดอร์และอาหาร ถ้าผิดพลาดให้ย้อนกลับทั้งชุด
function transaction(work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// สร้างโต๊ะเริ่มต้น 50 โต๊ะ พร้อมกำหนดจำนวนที่นั่ง
for (let n = 1; n <= 50; n++) {
  let capacity = 4;
  if (n % 5 === 0) capacity = 6;
  if (n % 10 === 0) capacity = 8;
  if (n === 50) capacity = 10;
  run(
    `INSERT OR IGNORE INTO DiningTable (table_id, table_no, capacity)
      VALUES (?, ?, ?)`,
    ['TBL-' + String(n).padStart(2, '0'), String(n), capacity]
  );
}
// เติมเมนูและบัญชีเริ่มต้น โดยไม่เขียนทับข้อมูลเดิม
for (const seed of ['seed.sql', 'seed-accounts.sql']) {
  db.exec(fs.readFileSync(path.join(__dirname, seed), 'utf8'));
}
module.exports = { db, query, get, run, transaction };
