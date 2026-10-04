# แผน Implementation: ระบบ Middleware ยืนยันตัวตนและจำกัดสิทธิ์ตามบทบาท

> **สำหรับ agentic workers:** REQUIRED SUB-SKILL: ใช้ superpowers:subagent-driven-development (แนะนำ) หรือ superpowers:executing-plans เพื่อทำทีละ task ขั้นตอนใช้ checkbox (`- [ ]`) สำหรับติดตามความคืบหน้า

> ⛔ **ห้าม commit ใด ๆ โดยไม่ขออนุญาตเจ้าของโปรเจกต์ก่อน** — แผนนี้จึงไม่มีขั้นตอน commit เลย แต่ละ task จบด้วยขั้นตอน *ตรวจสอบ* แทน เมื่อทำครบแล้วให้รายงานว่าไฟล์ไหนเปลี่ยนบ้าง แล้วรอคำสั่ง

**Goal:** เพิ่มชั้น middleware ให้ลูกค้าเข้าหลังร้านไม่ได้ พนักงานแต่ละบทบาททำได้เฉพาะงานตัวเอง มีบทบาท ADMIN ที่เข้าได้ทุกส่วน และมีระบบ login ที่เก็บรหัสผ่านด้วย bcrypt

**Architecture:** ใช้ signed cookie ของ `cookie-parser` โดยแยกชื่อ cookie ตาม role (`staff_CASHIER`, `staff_KITCHEN`, ...) เพื่อให้ล็อกอินหลายบทบาทพร้อมกันในเบราว์เซอร์เดียวได้ตอนสาธิต guard ติดตั้งที่ path prefix ตอน mount ใน `server.js` จึงไม่ต้องแก้ไฟล์ `routes/*.js` เดิมเลย และตอบ 401 JSON แยกจาก redirect เพราะระบบเรียก API ด้วย `fetch()` เป็นหลัก

**Tech Stack:** Node.js 24 / Express 5 / EJS / SQLite3 / cookie-parser (มีอยู่แล้ว) / bcryptjs (เพิ่มใหม่) / `node:test` สำหรับทดสอบ (มากับ Node ไม่ต้องลง)

**Spec:** `docs/superpowers/specs/2026-10-04-middleware-auth-design.md`

## Global Constraints

- **ต้องรันได้ด้วยคำสั่งเดียว** (`start.bat`) ตามเกณฑ์ส่งงานข้อ (4) — ห้ามเพิ่มขั้นตอนที่ต้องทำมือ
- **ห้ามเพิ่ม dependency ที่ต้อง compile** (node-gyp) เพราะเสี่ยง `npm install` พังบนเครื่องอาจารย์ — `bcryptjs` เป็น pure JS ผ่านเกณฑ์นี้
- `secure: false` ในทุก cookie เพราะตอนตรวจรันบน `http://localhost` ถ้าตั้ง `true` เบราว์เซอร์จะไม่ส่ง cookie เลย
- **ห้ามแก้ไฟล์ `routes/*.js` เดิมทั้ง 5 ไฟล์** — guard ติดตั้งที่ `server.js` เท่านั้น
- **ห้ามแก้ตารางอื่นนอกจาก Employee** — FK จาก 4 ตารางชี้มาที่ `employee_id` ต้องทำงานเหมือนเดิม
- ข้อความที่ผู้ใช้เห็นทุกจุดเป็น**ภาษาไทย** ให้เข้ากับระบบเดิม
- cookie ทุกตัวใช้ค่าเดียวกัน: `httpOnly: true, signed: true, sameSite: 'strict', secure: false, maxAge: 12 ชั่วโมง`
- ชื่อ cookie = `staff_` + role เช่น `staff_KITCHEN`
- 4 role ที่รู้จัก: `ADMIN`, `CASHIER`, `KITCHEN`, `SERVICE`

---

## โครงสร้างไฟล์

| ไฟล์ | สถานะ | หน้าที่ |
|---|---|---|
| `middlewares/auth.helpers.js` | สร้าง | ค่าคงที่ + ฟังก์ชันล้วนที่ไม่แตะ I/O (ทดสอบได้ง่าย) |
| `middlewares/auth.middleware.js` | สร้าง | `requireRole(role)` — ตรวจ cookie แล้วโหลด Employee |
| `middlewares/customer.middleware.js` | สร้าง | `requireDiningSession()` — รวม logic ตรวจ qr_token ที่ซ้ำ 3 ที่ |
| `middlewares/error.middleware.js` | สร้าง | `notFound()` + `errorHandler()` |
| `controllers/auth.controller.js` | สร้าง | `showLogin` / `login` / `logout` |
| `routes/auth.routes.js` | สร้าง | `/login` `/logout` |
| `views/auth/login.ejs` | สร้าง | หน้าฟอร์มเข้าสู่ระบบ |
| `scripts/generate-accounts.js` | สร้าง | สร้าง `database/seed-accounts.sql` พร้อม bcrypt hash |
| `database/seed-accounts.sql` | สร้างโดยสคริปต์ | INSERT บัญชีพนักงาน 5 คน |
| `tests/auth.helpers.test.js` | สร้าง | ทดสอบฟังก์ชันล้วน |
| `tests/auth.middleware.test.js` | สร้าง | ทดสอบการตอบ redirect vs 401 |
| `database/schema.sql` | แก้ | เพิ่ม `password_hash` + role ADMIN |
| `database/seed.sql` | แก้ | ย้าย Employee ออกไป `seed-accounts.sql` |
| `database/database.js` | แก้ | รัน `seed-accounts.sql` + schema guard |
| `server.js` | แก้ | secret, mount guard, root redirect, error handler |
| `controllers/{cashier,kitchen,serving,queue}.controller.js` | แก้ | ใช้ `req.staff.employee_id` |
| `controllers/customer.controller.js` | แก้ | ใช้ `req.diningSession` |
| `views/partials/header.ejs` | แก้ | แสดงชื่อผู้ใช้ + ปุ่มออกจากระบบ |
| `package.json` | แก้ | เพิ่ม `bcryptjs` + script `test` และ `seed:accounts` |
| `start.bat` / `reset-db.bat` / `README.txt` | สร้าง | การส่งงาน |

---

## Task 1: ฐานข้อมูลรองรับรหัสผ่านและบทบาท ADMIN

**Files:**
- Modify: `database/schema.sql:4-10`
- Modify: `database/seed.sql:3-8`
- Modify: `database/database.js:25-71`
- Modify: `package.json`
- Create: `scripts/generate-accounts.js`
- Create: `database/seed-accounts.sql` (สร้างโดยสคริปต์ ไม่ต้องพิมพ์เอง)

**Interfaces:**
- Consumes: ไม่มี (task แรก)
- Produces: ตาราง `Employee` ที่มีคอลัมน์ `password_hash TEXT NOT NULL` และ `role` รับค่า `ADMIN` ได้ / บัญชี 5 แถว `EMP-000`..`EMP-004` / ฟังก์ชัน `db.get`, `db.query`, `db.run` เดิมไม่เปลี่ยน

- [ ] **Step 1: ติดตั้ง bcryptjs**

```bash
npm install bcryptjs
```

ตรวจว่าเป็น pure JS จริง — คำสั่งนี้ต้องไม่มีการ compile และต้องไม่มีโฟลเดอร์ `build/`:

```bash
ls node_modules/bcryptjs
```

- [ ] **Step 2: เพิ่ม script ลง package.json**

เพิ่มใน `"scripts"` (แทนที่ `"test"` เดิมที่เป็น `echo "Error: no test specified" && exit 1`):

```json
"scripts": {
  "start": "node server.js",
  "test": "node --test tests/",
  "seed:accounts": "node scripts/generate-accounts.js"
}
```

- [ ] **Step 3: แก้ตาราง Employee ใน schema.sql**

แทนที่บล็อก `-- 1. Employee` ทั้งบล็อก (บรรทัด 4-10) ด้วย:

```sql
-- 1. Employee
CREATE TABLE IF NOT EXISTS Employee (
    employee_id   TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('ADMIN', 'CASHIER', 'KITCHEN', 'SERVICE'))
);
```

- [ ] **Step 4: เอาบล็อก Employee ออกจาก seed.sql**

ลบบรรทัด 3-8 ของ `database/seed.sql` (ตั้งแต่ `-- 1. Seed Employees` ถึงบรรทัดที่ลงท้ายด้วย `'SERVICE');`) แล้วใส่คอมเมนต์แทน:

```sql
-- 1. Seed Employees → ย้ายไป seed-accounts.sql (สร้างด้วย npm run seed:accounts)
```

เหตุผล: รหัสผ่านต้องเป็น bcrypt hash ซึ่งพิมพ์มือไม่ได้ ต้องให้สคริปต์สร้างให้

- [ ] **Step 5: เขียนสคริปต์สร้างบัญชี**

สร้าง `scripts/generate-accounts.js`:

```js
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
```

- [ ] **Step 6: รันสคริปต์**

```bash
npm run seed:accounts
```

Expected: พิมพ์ `เขียน ...\database\seed-accounts.sql เรียบร้อย — 5 บัญชี`

เปิดไฟล์ดูว่าแต่ละแถวมี hash ขึ้นต้นด้วย `$2a$10$` หรือ `$2b$10$` และยาวประมาณ 60 ตัวอักษร

- [ ] **Step 7: ให้ database.js รัน seed-accounts.sql และตรวจเวอร์ชัน schema**

ใน `database/database.js` แทนที่ `initDatabase()` และ `migrate()` (บรรทัด 25-71) ด้วย:

```js
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
// และ CHECK constraint ของ role ก็ยังไม่รู้จัก ADMIN ซึ่ง SQLite แก้ด้วย
// ALTER TABLE ไม่ได้ ต้องสร้างตารางใหม่ — จึงแจ้งให้ลบ .db แทนการเดา
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
            console.error('  กรุณารัน reset-db.bat เพื่อสร้างฐานข้อมูลใหม่');
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
```

- [ ] **Step 8: ตรวจสอบ — สร้างฐานข้อมูลใหม่แล้วข้อมูลต้องครบ**

ลบฐานข้อมูลเดิมแล้วเริ่มใหม่:

```bash
rm -rf data
npm start
```

Expected ใน console: `Database schema created/verified successfully.` ตามด้วย `Database seeded successfully.` และ **ต้องไม่มีข้อความฐานข้อมูลเวอร์ชันเก่า**

ปิดเซิร์ฟเวอร์ แล้วตรวจข้อมูลที่ seed:

```bash
node -e "const db=require('./database/database');setTimeout(async()=>{const r=await db.query('SELECT employee_id,username,role,length(password_hash) len FROM Employee ORDER BY employee_id');console.table(r);process.exit(0)},1500)"
```

Expected: 5 แถว, มี `EMP-000` role `ADMIN`, ทุกแถว `len` ประมาณ 60

- [ ] **Step 9: ตรวจสอบ — รหัสผ่านตรวจสอบได้จริง**

```bash
node -e "const b=require('bcryptjs');const db=require('./database/database');setTimeout(async()=>{const e=await db.get('SELECT password_hash FROM Employee WHERE username=?',['admin']);console.log('รหัสถูก:',b.compareSync('admin123',e.password_hash));console.log('รหัสผิด:',b.compareSync('wrong',e.password_hash));process.exit(0)},1500)"
```

Expected: `รหัสถูก: true` และ `รหัสผิด: false`

- [ ] **Step 10: ตรวจสอบ — schema guard ทำงาน**

ทดสอบว่าถ้าฐานข้อมูลเก่าจริง ๆ จะเตือน:

```bash
node -e "const s=require('sqlite3');const d=new s.Database('data/restaurant.db');d.run('ALTER TABLE Employee RENAME TO Employee_old',()=>d.run(\"CREATE TABLE Employee (employee_id TEXT PRIMARY KEY, username TEXT, full_name TEXT, role TEXT)\",()=>process.exit(0)))"
npm start
```

Expected: ขึ้นกรอบข้อความ `ฐานข้อมูลเป็นเวอร์ชันเก่า (ไม่มีคอลัมน์ password_hash)` และ **ไม่มี** `Database seeded successfully.`

จากนั้นคืนสภาพ:

```bash
rm -rf data && npm start
```

Expected: กลับมา seed สำเร็จตามปกติ

---

## Task 2: ฟังก์ชันช่วยเหลือของ auth (ฟังก์ชันล้วน ทดสอบได้)

**Files:**
- Create: `middlewares/auth.helpers.js`
- Create: `tests/auth.helpers.test.js`

**Interfaces:**
- Consumes: ไม่มี
- Produces:
  - `ROLES: string[]` — `['ADMIN','CASHIER','KITCHEN','SERVICE']`
  - `COOKIE_PREFIX: string` — `'staff_'`
  - `COOKIE_OPTIONS: object` — ออปชัน cookie ที่ใช้ร่วมกันทุกที่
  - `HOME_BY_ROLE: Record<string,string>` — หน้าแรกของแต่ละ role
  - `cookieNameFor(role: string): string`
  - `wantsHtml(req): boolean` — true เมื่อ request มาจากการเปิดหน้าเว็บ ไม่ใช่ `fetch()`
  - `safeNextPath(next: unknown): string | null` — คืน path ที่ปลอดภัย หรือ null

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

สร้าง `tests/auth.helpers.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const {
    ROLES, COOKIE_PREFIX, COOKIE_OPTIONS, HOME_BY_ROLE,
    cookieNameFor, wantsHtml, safeNextPath
} = require('../middlewares/auth.helpers');

// จำลอง req แบบง่าย — ของจริง Express มี req.get() ให้
const reqWithAccept = (accept) => ({ get: () => accept });

test('cookieNameFor ประกอบชื่อ cookie ตาม role', () => {
    assert.strictEqual(cookieNameFor('KITCHEN'), 'staff_KITCHEN');
    assert.strictEqual(cookieNameFor('ADMIN'), 'staff_ADMIN');
});

test('ชื่อ cookie ของแต่ละ role ต้องไม่ซ้ำกัน เพื่อให้ล็อกอินพร้อมกันได้', () => {
    const names = ROLES.map(cookieNameFor);
    assert.strictEqual(new Set(names).size, ROLES.length);
});

test('ทุก role ต้องมีหน้าแรกกำหนดไว้', () => {
    for (const role of ROLES) {
        assert.ok(HOME_BY_ROLE[role], `role ${role} ไม่มีหน้าแรก`);
        assert.ok(HOME_BY_ROLE[role].startsWith('/'));
    }
});

test('COOKIE_OPTIONS ต้องเซ็นชื่อ ปิด JS และไม่บังคับ https', () => {
    assert.strictEqual(COOKIE_OPTIONS.signed, true);
    assert.strictEqual(COOKIE_OPTIONS.httpOnly, true);
    // ต้องเป็น false เพราะตอนตรวจงานรันบน http://localhost
    assert.strictEqual(COOKIE_OPTIONS.secure, false);
});

test('wantsHtml เป็น true เมื่อเปิดหน้าเว็บจาก address bar', () => {
    assert.strictEqual(wantsHtml(reqWithAccept('text/html,application/xhtml+xml,*/*;q=0.8')), true);
});

test('wantsHtml เป็น false เมื่อมาจาก fetch()', () => {
    assert.strictEqual(wantsHtml(reqWithAccept('*/*')), false);
    assert.strictEqual(wantsHtml(reqWithAccept('application/json')), false);
});

test('wantsHtml ไม่พังเมื่อไม่มี header Accept', () => {
    assert.strictEqual(wantsHtml({ get: () => undefined }), false);
});

test('safeNextPath ยอมรับ path ภายในเว็บ', () => {
    assert.strictEqual(safeNextPath('/kitchen'), '/kitchen');
    assert.strictEqual(safeNextPath('/cashier/bill/SES-1'), '/cashier/bill/SES-1');
});

test('safeNextPath ปฏิเสธลิงก์ออกนอกเว็บ (กัน open redirect)', () => {
    assert.strictEqual(safeNextPath('https://evil.com'), null);
    assert.strictEqual(safeNextPath('//evil.com'), null);
    assert.strictEqual(safeNextPath('http://evil.com/x'), null);
});

test('safeNextPath ปฏิเสธค่าที่ไม่ใช่ข้อความหรือว่างเปล่า', () => {
    assert.strictEqual(safeNextPath(undefined), null);
    assert.strictEqual(safeNextPath(''), null);
    assert.strictEqual(safeNextPath(123), null);
    assert.strictEqual(safeNextPath('kitchen'), null);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../middlewares/auth.helpers'`

- [ ] **Step 3: เขียนโค้ดให้ผ่าน**

สร้าง `middlewares/auth.helpers.js`:

```js
// ค่าคงที่และฟังก์ชันล้วนของระบบยืนยันตัวตน
// แยกออกมาจาก auth.middleware.js เพื่อให้ทดสอบได้โดยไม่ต้องแตะฐานข้อมูล

const ROLES = ['ADMIN', 'CASHIER', 'KITCHEN', 'SERVICE'];

const COOKIE_PREFIX = 'staff_';

const COOKIE_OPTIONS = {
    httpOnly: true,
    signed: true,
    sameSite: 'strict',
    secure: false,              // ต้องเป็น false เพราะรันบน http://localhost ตอนตรวจงาน
    maxAge: 12 * 60 * 60 * 1000 // 12 ชั่วโมง
};

const HOME_BY_ROLE = {
    ADMIN: '/cashier/tables',
    CASHIER: '/cashier/tables',
    KITCHEN: '/kitchen',
    SERVICE: '/serving'
};

function cookieNameFor(role) {
    return COOKIE_PREFIX + role;
}

// แยกการเปิดหน้าเว็บออกจากการเรียก fetch()
// เบราว์เซอร์ส่ง Accept: text/html,... เมื่อเปิดหน้าเว็บ
// ส่วน fetch() ที่ไม่ได้ตั้ง Accept ส่ง */*
function wantsHtml(req) {
    return (req.get('accept') || '').includes('text/html');
}

// รับเฉพาะ path ภายในเว็บ กันไม่ให้ ?next= พาผู้ใช้ออกไปเว็บอื่น
function safeNextPath(next) {
    if (typeof next !== 'string') return null;
    if (!next.startsWith('/')) return null;
    if (next.startsWith('//')) return null;
    return next;
}

module.exports = {
    ROLES,
    COOKIE_PREFIX,
    COOKIE_OPTIONS,
    HOME_BY_ROLE,
    cookieNameFor,
    wantsHtml,
    safeNextPath
};
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

```bash
npm test
```

Expected: PASS ทั้ง 10 เทสต์ (`# pass 10`, `# fail 0`)

---

## Task 3: middleware ตรวจสิทธิ์ `requireRole`

**Files:**
- Create: `middlewares/auth.middleware.js`
- Create: `tests/auth.middleware.test.js`

**Interfaces:**
- Consumes: จาก Task 2 — `cookieNameFor()`, `wantsHtml()`, `COOKIE_PREFIX` / จาก Task 1 — `db.get()`
- Produces: `requireRole(role: string): (req, res, next) => Promise<void>` — เมื่อผ่านจะเซ็ต `req.staff` และ `res.locals.staff` เป็นอ็อบเจกต์ `{ employee_id, username, full_name, role }`

- [ ] **Step 1: เขียนเทสต์ที่ต้องแดงก่อน**

ทดสอบเฉพาะเส้นทางที่ **ไม่มี cookie** ซึ่งไม่แตะฐานข้อมูล — เป็นจุดที่เสี่ยงที่สุด (ตอบผิดแบบแล้ว AJAX พัง) ส่วนเส้นทางที่ต้องอ่านฐานข้อมูลจะตรวจด้วยเบราว์เซอร์ใน Task 5

สร้าง `tests/auth.middleware.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const requireRole = require('../middlewares/auth.middleware').requireRole;

function fakeRes() {
    return {
        locals: {},
        statusCode: null,
        jsonBody: null,
        redirectedTo: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.jsonBody = body; return this; },
        redirect(url) { this.redirectedTo = url; return this; }
    };
}

function fakeReq({ accept, url = '/kitchen' }) {
    return {
        get: () => accept,
        signedCookies: {},
        originalUrl: url
    };
}

test('ไม่มี cookie + เปิดหน้าเว็บ → เด้งไปหน้า login พร้อม next', async () => {
    const res = fakeRes();
    let nextCalled = false;
    await requireRole('KITCHEN')(
        fakeReq({ accept: 'text/html', url: '/kitchen' }),
        res,
        () => { nextCalled = true; }
    );
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.redirectedTo, '/login?next=' + encodeURIComponent('/kitchen'));
});

test('ไม่มี cookie + มาจาก fetch() → ตอบ 401 JSON ไม่ใช่ HTML', async () => {
    const res = fakeRes();
    let nextCalled = false;
    await requireRole('KITCHEN')(
        fakeReq({ accept: '*/*', url: '/kitchen/update-status' }),
        res,
        () => { nextCalled = true; }
    );
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.redirectedTo, null);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonBody.success, false);
    assert.ok(res.jsonBody.message.length > 0);
});

test('ไม่มี signedCookies เลย ก็ต้องไม่ throw', async () => {
    const res = fakeRes();
    const req = { get: () => '*/*', originalUrl: '/serving' };
    await requireRole('SERVICE')(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่าแดง**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../middlewares/auth.middleware'`

- [ ] **Step 3: เขียนโค้ดให้ผ่าน**

สร้าง `middlewares/auth.middleware.js`:

```js
const db = require('../database/database');
const { cookieNameFor, wantsHtml } = require('./auth.helpers');

// โหลดพนักงานจากฐานข้อมูลใหม่ทุกครั้ง ไม่เก็บ role ไว้ใน cookie
// เพื่อให้การแก้บทบาทหรือลบพนักงานมีผลทันที
// และไม่เอาข้อมูลจากฝั่ง client มาตัดสินสิทธิ์โดยตรง
async function loadStaff(employeeId, expectedRole) {
    if (!employeeId) return null;
    const row = await db.get(
        'SELECT employee_id, username, full_name, role FROM Employee WHERE employee_id = ?',
        [employeeId]
    );
    if (!row || row.role !== expectedRole) return null;
    return row;
}

// หาพนักงานที่มีสิทธิ์เข้าถึง: cookie ของ role นั้นก่อน ถ้าไม่มีลอง cookie ของ ADMIN
async function resolveStaff(req, role) {
    const cookies = req.signedCookies || {};
    const byRole = await loadStaff(cookies[cookieNameFor(role)], role);
    if (byRole) return byRole;
    return loadStaff(cookies[cookieNameFor('ADMIN')], 'ADMIN');
}

function requireRole(role) {
    return async function (req, res, next) {
        const staff = await resolveStaff(req, role);

        if (staff) {
            req.staff = staff;          // ให้ controller ใช้แทน employee_id ที่ hardcode
            res.locals.staff = staff;   // ให้ view ใช้แสดงชื่อบน navbar
            return next();
        }

        // ตอบคนละแบบตามชนิดของ request
        // ถ้า redirect request ที่มาจาก fetch() ฝั่งเบราว์เซอร์จะได้ HTML
        // แล้ว res.json() จะพังเงียบ ๆ ด้วย Unexpected token '<'
        if (wantsHtml(req)) {
            return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
        }
        return res.status(401).json({
            success: false,
            message: 'กรุณาเข้าสู่ระบบอีกครั้ง'
        });
    };
}

module.exports = { requireRole };
```

- [ ] **Step 4: รันเทสต์ให้เขียว**

```bash
npm test
```

Expected: PASS ทั้งหมด (`# pass 13`, `# fail 0`)

---

## Task 4: หน้าเข้าสู่ระบบและออกจากระบบ

**Files:**
- Create: `controllers/auth.controller.js`
- Create: `routes/auth.routes.js`
- Create: `views/auth/login.ejs`

**Interfaces:**
- Consumes: จาก Task 2 — `COOKIE_OPTIONS`, `HOME_BY_ROLE`, `ROLES`, `cookieNameFor()`, `safeNextPath()` / จาก Task 1 — ตาราง `Employee` ที่มี `password_hash`
- Produces: router ที่รองรับ `GET /login`, `POST /login`, `POST /logout` — export เป็น `module.exports = router`

- [ ] **Step 1: เขียน controller**

สร้าง `controllers/auth.controller.js`:

```js
const bcrypt = require('bcryptjs');
const db = require('../database/database');
const {
    ROLES, COOKIE_OPTIONS, HOME_BY_ROLE, cookieNameFor, safeNextPath
} = require('../middlewares/auth.helpers');

exports.showLogin = (req, res) => {
    res.render('auth/login', {
        title: 'เข้าสู่ระบบ',
        error: null,
        username: '',
        next: safeNextPath(req.query.next) || ''
    });
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const next = safeNextPath(req.body.next);

    const employee = await db.get('SELECT * FROM Employee WHERE username = ?', [username]);
    const passwordOk = employee && bcrypt.compareSync(password || '', employee.password_hash);

    if (!passwordOk) {
        // ไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน เพื่อกันการไล่เดาว่ามีบัญชีไหนอยู่บ้าง
        return res.status(401).render('auth/login', {
            title: 'เข้าสู่ระบบ',
            error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
            username: username || '',
            next: next || ''
        });
    }

    // ชื่อ cookie ผูกกับ role จึงล็อกอินหลายบทบาทพร้อมกันในเบราว์เซอร์เดียวได้
    res.cookie(cookieNameFor(employee.role), employee.employee_id, COOKIE_OPTIONS);
    res.redirect(next || HOME_BY_ROLE[employee.role]);
};

exports.logout = (req, res) => {
    const role = req.body.role;
    if (ROLES.includes(role)) {
        res.clearCookie(cookieNameFor(role), COOKIE_OPTIONS);
    }
    res.redirect('/login');
};
```

- [ ] **Step 2: เขียน routes**

สร้าง `routes/auth.routes.js`:

```js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;
```

- [ ] **Step 3: เขียนหน้า login**

สร้าง `views/auth/login.ejs` โดยใช้คลาส CSS ที่มีอยู่แล้วใน `public/css/style.css`
(`container`, `card`, `form-group`, `form-label`, `form-input`, `btn btn-primary btn-block`)

หน้านี้ไม่ใช้ `partials/header.ejs` เพราะ navbar นั้นมีลิงก์ของพนักงานซึ่งยังเข้าไม่ได้ตอนยังไม่ล็อกอิน

```html
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container" style="max-width: 400px; margin-top: 10vh;">
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">เข้าสู่ระบบพนักงาน</h2>
            </div>

            <% if (error) { %>
                <p style="color:#c8401a; margin: 0 0 16px;"><%= error %></p>
            <% } %>

            <form method="POST" action="/login">
                <input type="hidden" name="next" value="<%= next %>">

                <div class="form-group">
                    <label class="form-label" for="username">ชื่อผู้ใช้</label>
                    <input class="form-input" type="text" id="username" name="username"
                           value="<%= username %>" required autofocus autocomplete="username">
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">รหัสผ่าน</label>
                    <input class="form-input" type="password" id="password" name="password"
                           required autocomplete="current-password">
                </div>

                <button type="submit" class="btn btn-primary btn-block">เข้าสู่ระบบ</button>
            </form>
        </div>
    </div>
</body>
</html>
```

- [ ] **Step 4: ตรวจสอบ — ยังเข้าหน้า login ไม่ได้ (ยังไม่ได้ mount)**

ยังไม่ต้องทดสอบตอนนี้ — route จะถูก mount ใน Task 5 แล้วค่อยทดสอบพร้อมกัน

ตรวจแค่ว่าไฟล์ไม่มี syntax error:

```bash
node -e "require('./routes/auth.routes'); console.log('โหลด auth.routes ได้')"
```

Expected: `โหลด auth.routes ได้`

---

## Task 5: ติดตั้ง guard ใน server.js

**Files:**
- Modify: `server.js:18-48`

**Interfaces:**
- Consumes: จาก Task 3 — `requireRole()` / จาก Task 4 — `routes/auth.routes`
- Produces: แอปที่บังคับล็อกอินสำหรับ `/cashier/**`, `/kitchen/**`, `/serving/**`

- [ ] **Step 1: เพิ่ม secret และส่งเข้า cookieParser**

ใน `server.js` แก้บล็อก Middlewares (บรรทัด 18-22) เป็น:

```js
// กุญแจสำหรับเซ็นชื่อ cookie — กันคนแก้ค่า cookie เองเพื่อปลอมเป็นพนักงานบทบาทอื่น
// ย้ายไปเก็บใน .env ภายหลังได้โดยเปลี่ยนเป็น:
//   const SESSION_SECRET = process.env.SESSION_SECRET || 'moo-krata-dev-secret-2026';
const SESSION_SECRET = 'moo-krata-dev-secret-2026';

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));
```

- [ ] **Step 2: import auth routes และ middleware**

เพิ่มต่อจากบรรทัด `const queueRoutes = require('./routes/queue.routes');`:

```js
const authRoutes = require('./routes/auth.routes');
const { requireRole } = require('./middlewares/auth.middleware');
```

- [ ] **Step 3: ติดตั้ง guard ก่อน mount routes**

แทนที่บล็อก `// Use Routes` และ home route (บรรทัด 38-48) ด้วย:

```js
// Use Routes
app.use('/', authRoutes);   // ต้องอยู่ก่อน guard เพราะหน้า login ต้องเข้าได้โดยไม่ต้องล็อกอิน

// ตรวจสิทธิ์ที่ path prefix ตอน mount — ครอบทุก route ใต้ prefix นั้นในครั้งเดียว
// จึงไม่ต้องแก้ไฟล์ routes/*.js เดิม และไม่มีทางลืมใส่ตอนเพิ่ม route ใหม่
// หมายเหตุ: '/cashier' ครอบ queue.routes.js ให้ด้วย เพราะทุก path เป็น /cashier/queue/*
app.use('/kitchen', requireRole('KITCHEN'));
app.use('/serving', requireRole('SERVICE'));
app.use('/cashier', requireRole('CASHIER'));

app.use('/', customerRoutes);
app.use('/', kitchenRoutes);
app.use('/', servingRoutes);
app.use('/', cashierRoutes);
app.use('/', queueRoutes);

// หน้าแรกพาไปหน้าเข้าสู่ระบบ
app.get('/', (req, res) => {
    res.redirect('/login');
});
```

- [ ] **Step 4: ตรวจสอบ — ลูกค้าเข้าหลังร้านไม่ได้ (ข้อกำหนดที่ 1)**

```bash
npm start
```

เปิดเบราว์เซอร์แล้วลองเข้าทีละ URL โดย**ยังไม่ล็อกอิน**:

| URL | ผลที่ต้องได้ |
|---|---|
| `http://localhost:3000/` | เด้งไป `/login` |
| `http://localhost:3000/kitchen` | เด้งไป `/login?next=%2Fkitchen` |
| `http://localhost:3000/serving` | เด้งไป `/login?next=%2Fserving` |
| `http://localhost:3000/cashier/tables` | เด้งไป `/login?next=%2Fcashier%2Ftables` |

- [ ] **Step 5: ตรวจสอบ — AJAX ได้ JSON ไม่ใช่ HTML**

```bash
curl -s -o /dev/null -w "status=%{http_code} type=%{content_type}\n" -X POST http://localhost:3000/kitchen/update-status
```

Expected: `status=401 type=application/json; charset=utf-8`

**ถ้าได้ `text/html` แปลว่าการแยก wantsHtml พัง** — ต้องแก้ก่อนไปต่อ เพราะจะทำให้ปุ่มทุกปุ่มเงียบตอนสาธิต

- [ ] **Step 6: ตรวจสอบ — ล็อกอินแล้วเข้าได้**

เปิด `http://localhost:3000/login` กรอก `kitchen1` / `kitchen123` → ต้องเด้งไป `/kitchen` และเห็นหน้าครัว

จากนั้นในแท็บเดียวกันลองเข้า `http://localhost:3000/cashier/tables` → **ต้องเด้งกลับไป `/login`** เพราะบัญชีครัวไม่มีสิทธิ์แคชเชียร์ (ข้อกำหนดที่ 2)

- [ ] **Step 7: ตรวจสอบ — ADMIN เข้าได้ทุกส่วน (ข้อกำหนดที่ 3)**

ล็อกอินด้วย `admin` / `admin123` แล้วเข้าทั้ง 3 URL:

```
http://localhost:3000/cashier/tables   → เข้าได้
http://localhost:3000/kitchen          → เข้าได้
http://localhost:3000/serving          → เข้าได้
```

- [ ] **Step 8: ตรวจสอบ — ล็อกอินหลายบทบาทพร้อมกัน (ข้อกำหนดที่ 4)**

ในเบราว์เซอร์เดียวกัน ล็อกอินเรียงกัน: `cashier1`, `kitchen1`, `service1`
จากนั้นเปิด 3 แท็บค้างไว้: `/cashier/tables`, `/kitchen`, `/serving`

**ทั้ง 3 แท็บต้องใช้งานได้พร้อมกัน ไม่มีแท็บไหนเด้งออก**

เปิด DevTools → Application → Cookies ต้องเห็น `staff_CASHIER`, `staff_KITCHEN`, `staff_SERVICE` อยู่ครบพร้อมกัน

- [ ] **Step 9: ตรวจสอบ — cookie ปลอมไม่ได้**

ใน DevTools → Application → Cookies แก้ค่า `staff_KITCHEN` เป็น `EMP-000` แล้วรีเฟรช `/kitchen`

Expected: เด้งไป `/login` เพราะลายเซ็นไม่ตรง

---

## Task 6: ให้ controller บันทึกพนักงานที่ล็อกอินจริง

**Files:**
- Modify: `controllers/cashier.controller.js:43`, `controllers/cashier.controller.js:199`
- Modify: `controllers/kitchen.controller.js:63`
- Modify: `controllers/serving.controller.js:51`
- Modify: `controllers/queue.controller.js:126`

**Interfaces:**
- Consumes: จาก Task 3 — `req.staff` ที่ `requireRole()` เซ็ตไว้
- Produces: ไม่มี API ใหม่ — เปลี่ยนพฤติกรรมการบันทึกข้อมูลเท่านั้น

- [ ] **Step 1: แก้ cashier.controller.js จุดที่ 1 (เปิดโต๊ะ)**

บรรทัด 43 เปลี่ยนจาก:

```js
    const employee_id = req.body.employee_id || 'EMP-001';
```

เป็น:

```js
    const employee_id = req.staff.employee_id;
```

- [ ] **Step 2: แก้ cashier.controller.js จุดที่ 2 (รับชำระเงิน)**

บรรทัด 199 เปลี่ยนจาก:

```js
    const employee_id = req.body.employee_id || 'EMP-001';
```

เป็น:

```js
    const employee_id = req.staff.employee_id;
```

- [ ] **Step 3: แก้ kitchen.controller.js**

บรรทัด 63 เปลี่ยนจาก:

```js
    const employee_id = req.body.employee_id || 'EMP-002'; // Kitchen Staff
```

เป็น:

```js
    const employee_id = req.staff.employee_id;
```

- [ ] **Step 4: แก้ serving.controller.js**

บรรทัด 51 เปลี่ยนจาก:

```js
    const employee_id = req.body.employee_id || 'EMP-003';
```

เป็น:

```js
    const employee_id = req.staff.employee_id;
```

- [ ] **Step 5: แก้ queue.controller.js**

บรรทัด 126 เปลี่ยนจาก:

```js
    const employee_id = req.body.employee_id || 'EMP-001';
```

เป็น:

```js
    const employee_id = req.staff.employee_id;
```

- [ ] **Step 6: ตรวจสอบว่าไม่มี hardcode เหลืออยู่**

```bash
grep -rn "employee_id || 'EMP-" controllers/
```

Expected: ไม่มีผลลัพธ์เลย

- [ ] **Step 7: ตรวจสอบ — ฐานข้อมูลบันทึกคนที่ล็อกอินจริง (ข้อกำหนดที่ 5)**

ล็อกอินเป็น `service2` (EMP-004 — บัญชีที่ไม่เคยถูกใช้งานเลยก่อนหน้านี้) แล้วทำครบวงจร:

1. ล็อกอิน `cashier1` → เปิดโต๊ะหนึ่งโต๊ะ
2. สแกน/เปิด QR ของโต๊ะนั้น → สั่งอาหาร 1 รายการ
3. ล็อกอิน `kitchen1` → กดทำอาหารจนเป็น READY
4. ล็อกอิน `service2` → กดยืนยันเสิร์ฟ

จากนั้นตรวจฐานข้อมูล:

```bash
node -e "const db=require('./database/database');setTimeout(async()=>{const r=await db.query('SELECT order_item_id, prepared_by, served_by FROM OrderItem ORDER BY rowid DESC LIMIT 3');console.table(r);process.exit(0)},1500)"
```

Expected: `served_by` เป็น `EMP-004` (ไม่ใช่ `EMP-003` ที่เคย hardcode ไว้) และ `prepared_by` เป็น `EMP-002`

---

## Task 7: แสดงผู้ใช้ที่ล็อกอินและปุ่มออกจากระบบ

**Files:**
- Modify: `views/partials/header.ejs:22-27`

**Interfaces:**
- Consumes: จาก Task 3 — `res.locals.staff` / จาก Task 4 — `POST /logout` ที่รับฟิลด์ `role`
- Produces: ไม่มี

- [ ] **Step 1: เพิ่มชื่อผู้ใช้และปุ่มออกจากระบบใน navbar**

แทนที่บล็อก `<nav class="nav-links">` (บรรทัด 22-26) ด้วย:

```html
        <nav class="nav-links">
            <a href="/cashier/tables" class="nav-link" data-match="/cashier">แคชเชียร์</a>
            <a href="/kitchen" class="nav-link" data-match="/kitchen">ครัว</a>
            <a href="/serving" class="nav-link" data-match="/serving">เสิร์ฟ</a>
            <% if (typeof staff !== 'undefined' && staff) { %>
                <span class="nav-link" style="cursor: default;"><%= staff.full_name %></span>
                <form method="POST" action="/logout" style="display: inline;">
                    <input type="hidden" name="role" value="<%= staff.role %>">
                    <button type="submit" class="btn btn-secondary btn-sm">ออกจากระบบ</button>
                </form>
            <% } %>
        </nav>
```

ต้องเช็ก `typeof staff !== 'undefined'` เพราะ view บางหน้าอาจถูก render จากเส้นทางที่ไม่ผ่าน `requireRole()`

- [ ] **Step 2: ตรวจสอบ — เห็นชื่อตัวเองและออกจากระบบได้**

ล็อกอิน `kitchen1` แล้วเข้า `/kitchen`

Expected: บน navbar เห็นคำว่า `เชฟ สมชาย (ครัว)` และปุ่ม `ออกจากระบบ`

- [ ] **Step 3: ตรวจสอบ — ออกจากระบบแล้วบทบาทอื่นไม่หลุด**

ล็อกอินทั้ง `kitchen1` และ `cashier1` ในเบราว์เซอร์เดียวกัน แล้วกด `ออกจากระบบ` จากหน้าครัว

Expected:
- เด้งไป `/login`
- เข้า `/kitchen` อีกครั้ง → เด้งไป login (ถูกต้อง)
- เข้า `/cashier/tables` → **ยังเข้าได้ ไม่หลุด** (cookie ของแคชเชียร์ไม่ถูกลบ)

---

## Task 8: จัดการ 404 และข้อผิดพลาดที่ส่วนกลาง

> ⚠️ ต้องทำ task นี้**ก่อน** Task 9 เพราะ Task 9 จะตัด `try/catch` ออกจาก controller ของลูกค้า แล้วพึ่ง error handler ตัวนี้แทน

**Files:**
- Create: `middlewares/error.middleware.js`
- Modify: `server.js` (เพิ่มท้ายสุดก่อน `server.listen`)

**Interfaces:**
- Consumes: จาก Task 2 — `wantsHtml()`
- Produces: `notFound()` และ `errorHandler()` — ต้อง mount **หลัง** route ทั้งหมด

- [ ] **Step 1: เขียน middleware**

สร้าง `middlewares/error.middleware.js`:

```js
const { wantsHtml } = require('./auth.helpers');

// URL ที่ไม่ตรงกับ route ไหนเลย
function notFound(req, res) {
    const message = 'ไม่พบหน้าที่คุณต้องการ';
    if (wantsHtml(req)) {
        return res.status(404).render('error', { message });
    }
    res.status(404).json({ success: false, message });
}

// Express 5 ส่ง error จาก async controller มาที่นี่ให้อัตโนมัติ
// (Express 4 ทำไม่ได้ ต้องเขียน try/catch เองทุกที่)
// ต้องรับครบ 4 พารามิเตอร์ Express ถึงจะรู้ว่านี่คือ error handler
function errorHandler(err, req, res, _next) {
    console.error('เกิดข้อผิดพลาดที่ไม่ได้จัดการ:', err);

    const message = 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง';
    if (wantsHtml(req)) {
        return res.status(500).render('error', { message });
    }
    res.status(500).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
```

- [ ] **Step 2: ติดตั้งใน server.js**

เพิ่ม require ไว้รวมกับ require อื่นด้านบนไฟล์:

```js
const { notFound, errorHandler } = require('./middlewares/error.middleware');
```

แล้วเพิ่มหลัง route ทั้งหมด (หลัง `app.get('/', ...)`) และ **ก่อน** `io.on('connection', ...)`:

```js
// ต้องอยู่ท้ายสุดหลัง route ทั้งหมด
app.use(notFound);
app.use(errorHandler);
```

- [ ] **Step 3: ตรวจสอบ — 404 ตอบถูกทั้งสองแบบ**

```bash
curl -s -o /dev/null -w "html: status=%{http_code} type=%{content_type}\n" -H "Accept: text/html" http://localhost:3000/ไม่มีหน้านี้
curl -s -o /dev/null -w "ajax: status=%{http_code} type=%{content_type}\n" http://localhost:3000/ไม่มีหน้านี้
```

Expected:
```
html: status=404 type=text/html; charset=utf-8
ajax: status=404 type=application/json; charset=utf-8
```

- [ ] **Step 4: ตรวจสอบ — URL ที่พิมพ์ผิดไม่เด้งไปหน้า login**

เปิด `http://localhost:3000/kitchenn` (สะกดผิด) ในเบราว์เซอร์ที่ยังไม่ล็อกอิน

Expected: เห็นหน้า `ไม่พบหน้าที่คุณต้องการ` **ไม่ใช่** หน้า login
(ยืนยันว่าการติดตั้ง guard ที่ path prefix ทำงานถูก ไม่ไปดักทุก URL)

---

## Task 9: รวม logic ตรวจ qr_token ของลูกค้าเป็น middleware

**Files:**
- Create: `middlewares/customer.middleware.js`
- Modify: `controllers/customer.controller.js:29-62`, `:64-136`, `:138-176`
- Modify: `server.js` (บรรทัดที่ mount `customerRoutes`)

**Interfaces:**
- Consumes: จาก Task 2 — `wantsHtml()` / จาก Task 1 — `db.get()` / จาก Task 8 — `errorHandler()` ที่จะรับ error แทน `try/catch` ที่ถูกตัดออก
- Produces: `requireDiningSession()` middleware ที่เซ็ต `req.diningSession` เป็นแถว DiningSession ที่ JOIN กับ DiningTable แล้ว (มีฟิลด์ `table_no` เพิ่ม) และ `req.qrToken` เป็นสตริง token

- [ ] **Step 1: เขียน middleware**

สร้าง `middlewares/customer.middleware.js`:

```js
const db = require('../database/database');
const { wantsHtml } = require('./auth.helpers');

// รวม logic ที่เดิมถูกคัดลอกไว้ 3 ที่ใน customer.controller.js
// (getMenu, placeOrder, getOrderStatus) ให้เหลือจุดเดียว
function requireDiningSession() {
    return async function (req, res, next) {
        // token มาได้ 3 ทาง: query string, body (ตอนส่งออเดอร์), หรือ cookie ที่ตั้งไว้ตอนสแกน QR
        const token = req.query.token || (req.body && req.body.token) || (req.cookies && req.cookies.qr_token);

        const deny = (message) => wantsHtml(req)
            ? res.status(400).render('error', { message })
            : res.status(400).json({ success: false, message });

        if (!token) {
            return deny('กรุณาสแกน QR Code เพื่อเข้าสู่หน้าสั่งอาหาร');
        }

        const session = await db.get(`
            SELECT s.*, t.table_no
            FROM DiningSession s
            JOIN DiningTable t ON s.table_id = t.table_id
            WHERE s.qr_token = ? AND s.session_status = 'ACTIVE'
        `, [token]);

        if (!session) {
            return deny('รอบการใช้บริการของคุณจบแล้วหรือ QR Code ไม่ถูกต้อง');
        }

        req.diningSession = session;
        req.qrToken = token;
        next();
    };
}

module.exports = { requireDiningSession };
```

- [ ] **Step 2: ติดตั้ง middleware ใน server.js**

เพิ่ม require ไว้รวมกับ require อื่นด้านบนไฟล์:

```js
const { requireDiningSession } = require('./middlewares/customer.middleware');
```

แล้วเปลี่ยนบรรทัด `app.use('/', customerRoutes);` เป็น:

```js
app.use(['/menu', '/orders'], requireDiningSession());
app.use('/', customerRoutes);
```

ไม่ครอบ `/qr/:token` เพราะเส้นทางนั้นเป็นตัวที่ **ตั้ง** cookie ให้ตั้งแต่แรก

- [ ] **Step 3: ลดรูป getMenu**

แทนที่ `exports.getMenu` ทั้งฟังก์ชัน (บรรทัด 29-62) ด้วย:

```js
// Customer Menu Page
exports.getMenu = async (req, res) => {
    const session = req.diningSession;

    const categories = await db.query('SELECT * FROM Category ORDER BY sort_order ASC, category_id ASC');
    const menuItems = await db.query('SELECT * FROM MenuItem ORDER BY category_id ASC, menu_item_id ASC');

    res.render('customer/menu', {
        session,
        categories,
        menuItems,
        token: req.qrToken,
        title: `เมนูอาหาร - โต๊ะ ${session.table_no}`
    });
};
```

- [ ] **Step 4: ลดรูป placeOrder**

ใน `exports.placeOrder` ลบการตรวจ token และ session ออก — แทนที่ตั้งแต่บรรทัดแรกของฟังก์ชันถึงบรรทัดปิดของ `if (!session) {...}` ด้วย:

```js
// Place Order (Cart Submission)
exports.placeOrder = async (req, res) => {
    const { items } = req.body; // items = [{ menu_item_id, quantity }]
    const session = req.diningSession;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'ข้อมูลการสั่งซื้อไม่ถูกต้อง' });
    }

    try {
```

ส่วนที่เหลือของฟังก์ชัน (ตั้งแต่ `// Validate items availability`) **ไม่ต้องแก้** เพราะอ้างตัวแปร `session` เหมือนเดิม

- [ ] **Step 5: ลดรูป getOrderStatus**

แทนที่ `exports.getOrderStatus` ทั้งฟังก์ชัน (บรรทัด 138-176) ด้วย:

```js
// Customer Order Status Page
exports.getOrderStatus = async (req, res) => {
    const session = req.diningSession;

    const orders = await db.query(`
        SELECT oi.*, mi.item_name, mi.image_url, fo.ordered_at
        FROM OrderItem oi
        JOIN FoodOrder fo ON oi.order_id = fo.order_id
        JOIN MenuItem mi ON oi.menu_item_id = mi.menu_item_id
        WHERE fo.session_id = ?
        ORDER BY fo.ordered_at DESC, oi.order_item_id DESC
    `, [session.session_id]);

    res.render('customer/orders', {
        session,
        orders,
        token: req.qrToken,
        title: `สถานะออเดอร์ - โต๊ะ ${session.table_no}`
    });
};
```

- [ ] **Step 6: ตรวจสอบ — ฝั่งลูกค้ายังทำงานครบ**

1. ล็อกอิน `cashier1` → เปิดโต๊ะ → กดดู QR แล้วคัดลอก token
2. เปิด `http://localhost:3000/qr/<token>` → ต้องเด้งไป `/menu` และเห็นเมนู 57 รายการ
3. สั่งอาหาร 1 รายการ → ต้องขึ้นข้อความสำเร็จ
4. เปิด `/orders` → ต้องเห็นรายการที่สั่ง

- [ ] **Step 7: ตรวจสอบ — เข้าโดยไม่มี token ถูกปฏิเสธ**

เปิดหน้าต่าง incognito แล้วเข้า `http://localhost:3000/menu`

Expected: เห็นหน้า error ข้อความ `กรุณาสแกน QR Code เพื่อเข้าสู่หน้าสั่งอาหาร`

```bash
curl -s -o /dev/null -w "status=%{http_code} type=%{content_type}\n" -X POST http://localhost:3000/orders
```

Expected: `status=400 type=application/json; charset=utf-8`

---

## Task 10: ไฟล์สำหรับส่งงาน

**Files:**
- Create: `start.bat`
- Create: `reset-db.bat`
- Create: `README.txt`

**Interfaces:**
- Consumes: บัญชีจาก Task 1 / เส้นทางจาก Task 5
- Produces: ไม่มี

- [ ] **Step 1: เขียน start.bat**

```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===============================================
echo   ระบบสั่งอาหารร้านหมูกระทะ
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ผิดพลาด] ไม่พบ Node.js บนเครื่องนี้
    echo กรุณาติดตั้งจาก https://nodejs.org แล้วลองใหม่
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo กำลังติดตั้งแพ็กเกจที่จำเป็น กรุณารอสักครู่...
    call npm install
    if errorlevel 1 (
        echo [ผิดพลาด] ติดตั้งแพ็กเกจไม่สำเร็จ
        pause
        exit /b 1
    )
)

echo กำลังเริ่มเซิร์ฟเวอร์...
echo เปิดเบราว์เซอร์ที่ http://localhost:3000
echo กด Ctrl+C เพื่อหยุดการทำงาน
echo.

start "" http://localhost:3000/login
call npm start
pause
```

- [ ] **Step 2: เขียน reset-db.bat**

```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===============================================
echo   ล้างฐานข้อมูลและสร้างใหม่
echo ===============================================
echo.
echo คำเตือน: ข้อมูลโต๊ะ ออเดอร์ และบิลทั้งหมดจะถูกลบ
echo.

set /p confirm="พิมพ์ y แล้วกด Enter เพื่อยืนยัน: "
if /i not "%confirm%"=="y" (
    echo ยกเลิกแล้ว
    pause
    exit /b 0
)

if exist "data" rmdir /s /q "data"
echo ลบฐานข้อมูลเดิมเรียบร้อย
echo ฐานข้อมูลใหม่จะถูกสร้างอัตโนมัติเมื่อเริ่มเซิร์ฟเวอร์ครั้งถัดไป
echo.
pause
```

ไฟล์นี้**ถามยืนยันก่อนลบเสมอ** เพราะการลบข้อมูลโดยไม่ถามอาจทำให้ข้อมูลที่เตรียมไว้สาธิตหายทั้งหมด

- [ ] **Step 3: เขียน README.txt**

เกณฑ์ส่งงานข้อ (3) บังคับให้ระบุ URL และ username/password ของแต่ละ actor

```
ระบบสั่งอาหารร้านหมูกระทะผ่าน QR Code
วิชา 06066302 Fundamental Web Programming

=== วิธีเริ่มใช้งาน ===

ดับเบิลคลิกไฟล์ start.bat เพียงไฟล์เดียว
ระบบจะติดตั้งแพ็กเกจ สร้างฐานข้อมูล และเปิดเบราว์เซอร์ให้อัตโนมัติ

ต้องมี Node.js บนเครื่อง (ทดสอบบนเวอร์ชัน 24)
หากต้องการล้างข้อมูลเพื่อเริ่มสาธิตใหม่ ให้รัน reset-db.bat

=== เส้นทางและบัญชีของแต่ละ actor ===

[พนักงานแคชเชียร์]
  URL       http://localhost:3000/cashier/tables
  ชื่อผู้ใช้  cashier1
  รหัสผ่าน   cashier123
  ทำได้      เปิดโต๊ะ ออกบัตรคิว ดูบิล รับชำระเงิน ปิดบิล

[พนักงานครัว]
  URL       http://localhost:3000/kitchen
  ชื่อผู้ใช้  kitchen1
  รหัสผ่าน   kitchen123
  ทำได้      รับออเดอร์ เปลี่ยนสถานะการทำอาหาร แจ้งวัตถุดิบหมด

[พนักงานเสิร์ฟ]
  URL       http://localhost:3000/serving
  ชื่อผู้ใช้  service1   (หรือ service2)
  รหัสผ่าน   service123
  ทำได้      ดูรายการที่พร้อมเสิร์ฟ ยืนยันการเสิร์ฟ

[ผู้ดูแลระบบ]
  URL       http://localhost:3000/login
  ชื่อผู้ใช้  admin
  รหัสผ่าน   admin123
  ทำได้      เข้าถึงได้ทุกส่วนของระบบ

[ลูกค้า]
  ไม่ต้องล็อกอิน เข้าผ่านการสแกน QR Code ของโต๊ะ
  แคชเชียร์เปิดโต๊ะแล้วกดดู QR Code เพื่อให้ลูกค้าสแกน

=== หมายเหตุ ===

- รหัสผ่านเก็บในฐานข้อมูลด้วย bcrypt ไม่ได้เก็บเป็นข้อความธรรมดา
- พนักงานแต่ละบทบาทเข้าถึงได้เฉพาะหน้าของตนเอง ยกเว้นผู้ดูแลระบบ
- ล็อกอินหลายบทบาทพร้อมกันในเบราว์เซอร์เดียวได้ เพื่อให้สาธิตการทำงานแบบ real-time
```

- [ ] **Step 4: ตรวจสอบ — รันจากศูนย์ด้วยคำสั่งเดียว (ข้อกำหนดที่ 7)**

จำลองสภาพเครื่องอาจารย์:

```bash
rm -rf data node_modules
```

จากนั้นดับเบิลคลิก `start.bat` (หรือรัน `cmd //c start.bat`)

Expected:
- ติดตั้งแพ็กเกจเองจนเสร็จ ไม่มี error เรื่อง node-gyp
- เซิร์ฟเวอร์ขึ้น
- เบราว์เซอร์เปิดไปที่หน้า login
- ล็อกอิน `admin` / `admin123` ได้ทันที

- [ ] **Step 5: ตรวจสอบ — ล็อกอินค้างอยู่หลังรีสตาร์ท (ข้อกำหนดที่ 8)**

ล็อกอิน `kitchen1` แล้วเปิด `/kitchen` ค้างไว้
กด Ctrl+C ปิดเซิร์ฟเวอร์ แล้ว `npm start` ใหม่ จากนั้นรีเฟรชแท็บเดิม

Expected: **ยังอยู่ในระบบ ไม่เด้งไป login** (นี่คือเหตุผลที่เลือก signed cookie แทน express-session)

- [ ] **Step 6: ตรวจสอบรวบยอด — รันเทสต์ทั้งหมด**

```bash
npm test
```

Expected: PASS ทั้งหมด (`# fail 0`)

---

## เช็กลิสต์สุดท้าย (เกณฑ์ว่างานเสร็จ จาก spec ข้อ 14)

- [ ] ลูกค้าที่สแกน QR เข้า `/kitchen` `/serving` `/cashier/tables` ไม่ได้ ถูกเด้งไปหน้า login
- [ ] บัญชี KITCHEN เข้า `/cashier/tables` ไม่ได้ และ `/serving` ไม่ได้
- [ ] บัญชี ADMIN เข้าได้ครบทั้ง 3 ส่วน
- [ ] ล็อกอิน 3 บทบาทพร้อมกันในเบราว์เซอร์เดียว แล้วสาธิต Socket.IO real-time ได้เหมือนเดิม
- [ ] ฐานข้อมูลบันทึก `opened_by` `prepared_by` `served_by` `received_by` เป็นคนที่ล็อกอินจริง
- [ ] กดปุ่มใด ๆ ขณะ session หมดอายุ แล้วได้ข้อความแจ้งเตือน ไม่ใช่เงียบหาย
- [ ] ลบโฟลเดอร์ `data/` ทิ้ง แล้วรัน `start.bat` คำสั่งเดียว ใช้งานได้ครบ
- [ ] รีสตาร์ท server แล้วแท็บที่ล็อกอินค้างไว้ยังใช้งานได้ต่อ

## งานเอกสารที่ต้องทำต่อ (ไม่ใช่โค้ด)

- [ ] แก้ Data Dictionary ตาราง Employee ใน Report ให้มี `password_hash` และ role `ADMIN`
- [ ] เพิ่มชั้น middleware ในหัวข้อสถาปัตยกรรมของ Report
- [ ] เพิ่มหัวข้อ bcrypt และ signed cookie พร้อมตัวอย่างโค้ด
- [ ] ใส่ตัวอย่าง "ก่อน/หลังใช้ middleware" ของ `customer.controller.js` ในหัวข้อเทคนิคการพัฒนา
