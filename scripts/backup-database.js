// สำรองฐานข้อมูลร้านเป็นไฟล์ใหม่ในโฟลเดอร์ backups
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const source = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = 'restaurant-' + timestamp + '-' + randomUUID().slice(0, 8) + '.db';
const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups', filename));
fs.mkdirSync(path.dirname(target), { recursive: true });

// เปิดแบบอ่านอย่างเดียว แล้วสำรองข้อมูลที่รวม WAL ด้วย
const connection = new sqlite3.Database(source, sqlite3.OPEN_READONLY, (error) => {
  if (error) return fail(error);
  connection.configure('busyTimeout', 10000);
  connection.run('VACUUM INTO ?', [target], (error) => {
    if (error) fail(error);
    else console.log('สำรองฐานข้อมูลแล้ว:', target);
    connection.close();
  });
});
// แจ้งเมื่อสำรองฐานข้อมูลไม่สำเร็จ
function fail(error) {
  console.error('สำรองไม่สำเร็จ:', error.message);
  process.exitCode = 1;
}
