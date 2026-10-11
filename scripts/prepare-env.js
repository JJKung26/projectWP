// ใช้ตอนย้ายเครื่อง: ตั้งค่าทั่วไปครั้งแรก โดยพร้อมเพย์ยังอ่านจาก config.json
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const target = path.join(__dirname, '../.env');
if (!fs.existsSync(target)) {
    const example = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
    fs.writeFileSync(target, example.replace(/^SESSION_SECRET=.*$/m, 'SESSION_SECRET=' + randomBytes(32).toString('hex')));
    console.log('Created local .env. PromptPay settings remain in config.json.');
}
