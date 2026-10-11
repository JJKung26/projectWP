require('dotenv').config({ quiet:true });
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const source = process.env.DB_PATH || path.join(__dirname,'..','data','restaurant.db');
const target = path.resolve(process.argv[2] || path.join(__dirname,'..','backups','restaurant-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.db'));
fs.mkdirSync(path.dirname(target), { recursive:true });
// VACUUM INTO สำรองภาพฐานข้อมูลที่สอดคล้องกัน รวมข้อมูลที่ยังอยู่ใน WAL
const connection = new sqlite3.Database(source, sqlite3.OPEN_READWRITE, err => {
    if (err) { console.error('สำรองไม่สำเร็จ:',err.message); process.exitCode=1; return; }
    connection.configure('busyTimeout',10000);
    connection.run('VACUUM INTO ?', [target], err => {
        if (err) { console.error('สำรองไม่สำเร็จ:',err.message); process.exitCode=1; }
        else console.log('สำรองฐานข้อมูลแล้ว:',target);
        connection.close();
    });
});
