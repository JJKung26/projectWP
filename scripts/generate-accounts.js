// สร้าง database/seed-accounts.sql พร้อม bcrypt hash
// รันใหม่เมื่อต้องการเปลี่ยนรหัสผ่าน: npm run seed:accounts
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// รหัสผ่านสำหรับสาธิต — ต้องตรงกับที่เขียนใน README.txt
const ACCOUNTS = [
    ['EMP-000', 'admin',    'admin123',    'ผู้ดูแลระบบ',          'ADMIN'],
    ['EMP-001', 'cashier1', 'cashier123',  'แคชเชียร์ สมศรี',      'CASHIER'],
    ['EMP-002', 'kitchen1', 'kitchen123',  'เชฟ สมชาย (ครัว)',    'KITCHEN'],
    ['EMP-003', 'service1', 'service123',  'พนักงานเสิร์ฟ นพ',    'SERVICE'],
    ['EMP-004', 'service2', 'service123',  'พนักงานเสิร์ฟ ฝน',    'SERVICE']
];

const rows = ACCOUNTS.map(([id, username, password, fullName, role]) => {
    const hash = bcrypt.hashSync(password, 10);
    return `('${id}', '${username}', '${hash}', '${fullName}', '${role}')`;
}).join(',\n');

const sql = `-- สร้างอัตโนมัติด้วย npm run seed:accounts — ห้ามแก้ไฟล์นี้ด้วยมือ
-- รหัสผ่านจริงดูได้ที่ scripts/generate-accounts.js และ README.txt

INSERT OR IGNORE INTO Employee (employee_id, username, password_hash, full_name, role) VALUES
${rows};
`;

const outPath = path.join(__dirname, '..', 'database', 'seed-accounts.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log('เขียน', outPath, 'เรียบร้อย —', ACCOUNTS.length, 'บัญชี');
