# Design: ระบบ Middleware ยืนยันตัวตนและจำกัดสิทธิ์ตามบทบาท

วันที่: 2026-10-04
โปรเจกต์: ระบบสั่งอาหารร้านหมูกระทะผ่าน QR Code (06066302 Fundamental Web Programming)
สถานะ: อนุมัติดีไซน์แล้ว รอเขียนแผน implementation

---

## 1. เป้าหมาย

เพิ่มชั้น middleware ให้ระบบ โดยต้องได้ครบ 4 ข้อ

1. ลูกค้าเข้าถึงหน้าจัดการร้าน (แคชเชียร์ / ครัว / เสิร์ฟ) ไม่ได้
2. พนักงานแต่ละบทบาททำได้เฉพาะงานของตัวเอง โดยตรวจ role ก่อนเข้าถึงทุกเส้นทาง
3. เพิ่มบทบาท ADMIN ที่เข้าถึงได้ทุกส่วน
4. มีระบบ login ที่เก็บรหัสผ่านอย่างปลอดภัยด้วย bcrypt

ข้อจำกัดครอบงำทั้งหมด: **ต้องรันได้ด้วยคำสั่งเดียว** (`start.bat`) ตามเกณฑ์ส่งงานข้อ (4)
และ **ต้องไม่พังตอนนำเสนอและตอนอาจารย์ตรวจ**

## 2. สภาพปัจจุบันก่อนแก้

| เรื่อง | สภาพ |
|---|---|
| ตาราง Employee | 4 คอลัมน์ ไม่มีช่องเก็บรหัสผ่าน มีข้อมูล 4 คน |
| การระบุตัวพนักงาน | hardcode `req.body.employee_id \|\| 'EMP-001'` ใน 4 controller |
| view ส่ง employee_id ไหม | ไม่เคยส่งเลย → fallback ทำงาน 100% ของเวลา |
| ผลที่ตามมา | EMP-004 ไม่เคยถูกใช้งาน และ DB บันทึกว่าคนเดิมทำทุกอย่าง |
| การป้องกัน route พนักงาน | ไม่มีเลย ใครรู้ URL เข้าได้หมด |
| ของที่ใกล้เคียง auth ที่สุด | cookie `qr_token` ฝั่งลูกค้า ตรวจซ้ำ 3 ที่ใน customer.controller.js |
| รูปแบบการเรียก API | AJAX เป็นหลัก — `fetch()` + `res.json()` รวม 20 จุดใน 4 view |

## 3. ข้อตัดสินใจที่ตกลงแล้ว

| # | ประเด็น | มติ | เหตุผล |
|---|---|---|---|
| D1 | เอกสารไม่ตรงโค้ด | อัปเดต Data Dictionary ใน Report ให้ตรงโค้ด | เอกสารกับระบบต้องตรงกัน และเล่าเป็นพัฒนาการจากข้อเสนอได้ |
| D2 | ขอบเขต ADMIN | เข้าได้ทุกหน้าที่มีอยู่ ไม่สร้างหน้าใหม่ | เหลือเวลาจำกัด เลี่ยงงานบานปลาย |
| D3 | สาธิตหลาย role พร้อมกัน | แยกชื่อ cookie ตาม role | เปิดหน้าครัว/เสิร์ฟ/แคชเชียร์พร้อมกันในเบราว์เซอร์เดียวเพื่อโชว์ Socket.IO real-time |
| D4 | ไลบรารี hash + กลไก session | `bcryptjs` + signed cookie ของ `cookie-parser` | pure JS ไม่ต้อง compile, เรียกว่า "bcrypt" ในรายงานได้, ทนการรีสตาร์ท server |
| D5 | ที่มาของ cookie secret | hardcode เป็นค่าคงที่ใน `server.js` ไปก่อน | ย้ายไป `.env` ทีหลังใช้แค่ 2 บรรทัด ไม่คุ้มที่จะตัดสินใจตอนนี้ |
| D6 | เซ็น cookie หรือไม่ | เซ็น (`signed: true`) | ถ้าไม่เซ็น ใครก็พิมพ์ `staff_ADMIN=EMP-000` ใน DevTools แล้วเป็นแอดมินได้ → ข้อ 1-3 จะเป็นแค่เครื่องสำอาง |

### หมายเหตุสำคัญเรื่อง bcrypt กับ .env

bcrypt **ไม่ใช้ secret key** — มันสุ่ม salt เองแล้วฝังไว้ในสตริง hash
`$2a$10$<salt 22 ตัว><hash 31 ตัว>` ตอน verify ใช้ `bcrypt.compare()` ซึ่งดึง salt จากสตริงนั้นเอง
ดังนั้น **ระบบรหัสผ่านทำงานได้โดยไม่ต้องมี `.env` เลย** คนที่ clone ไปรันได้ทันที

secret ที่ต้องมีคือของ **การเซ็น cookie** เท่านั้น ซึ่งเป็นคนละชั้นกัน และตาม D5 เก็บไว้ในโค้ดก่อน

### ความสอดคล้องกับเนื้อหาที่เรียนในวิชา

อาจารย์สอน `cookie-parser` ด้วยตัวอย่าง `/set-cookie` `/get-cookie` `/clear-cookie`
ดีไซน์นี้ใช้ API ชุดเดียวกันทั้งหมด และแมปตรงกับบทเรียน

| ที่สอนในวิชา | ในระบบนี้ |
|---|---|
| `res.cookie()` | `POST /login` |
| `req.cookies` → เปลี่ยนเป็น `req.signedCookies` | `requireRole()` middleware |
| `res.clearCookie()` | `POST /logout` |

ต่างจากที่สอนแค่ 3 จุด: ใส่ secret ตอน `cookieParser(SECRET)`, เพิ่ม `signed: true`, อ่านจาก `req.signedCookies`
**ไม่ได้เพิ่มไลบรารีใหม่** ยังเป็น `cookie-parser` ตัวเดิม แค่เปิดออปชันที่มีอยู่แล้ว

---

## 4. การเปลี่ยนแปลงฐานข้อมูล

### 4.1 ตาราง Employee

```sql
CREATE TABLE IF NOT EXISTS Employee (
    employee_id   TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,                                       -- เพิ่ม
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL
                  CHECK(role IN ('ADMIN','CASHIER','KITCHEN','SERVICE'))  -- เพิ่ม ADMIN
);
```

**ตารางอื่นทั้ง 11 ตารางไม่แตะ** FK ที่ชี้มาที่ `employee_id`
(`opened_by`, `prepared_by`, `served_by`, `received_by`, `completed_by`) ทำงานเหมือนเดิม

### 4.2 ข้อมูล seed

เพิ่มบัญชี ADMIN หนึ่งแถว รวมเป็น 5 บัญชี

| employee_id | username | role |
|---|---|---|
| EMP-000 | admin | ADMIN |
| EMP-001 | cashier1 | CASHIER |
| EMP-002 | kitchen1 | KITCHEN |
| EMP-003 | service1 | SERVICE |
| EMP-004 | service2 | SERVICE |

รหัสผ่านเดโม: **เก็บเป็น bcrypt hash แบบ hardcode ใน `seed.sql`** ไม่ hash ตอน runtime เพราะ

- `seed.sql` ยังเป็น idempotent (`INSERT OR IGNORE`) ตามเดิม
- รหัสผ่านคงที่ทุกครั้งที่รัน → `README.txt` ที่ส่งอาจารย์เชื่อถือได้เสมอ
- ไม่มีขั้นตอน hash ตอน start → ไม่กระทบเวลาบูต

ค่ารหัสผ่านจริงกำหนดตอน implement และบันทึกไว้ที่ `seed.sql` กับ `README.txt` เท่านั้น
(เกณฑ์ส่งงานข้อ (3) บังคับให้ระบุ username/password ของแต่ละ actor ใน `README.txt`)

จะมีสคริปต์เล็ก ๆ สำหรับสร้าง hash ไว้ใช้ตอนพัฒนา ไม่ใช่ขั้นตอนตอนรันระบบ

### 4.3 Schema guard แทนการ migrate อัตโนมัติ

`migrate()` ที่ `database/database.js:58` ทำได้แค่ `ALTER TABLE ADD COLUMN`
แต่งานนี้ต้องแก้ `CHECK` constraint ซึ่ง **SQLite แก้ด้วย ALTER TABLE ไม่ได้** ต้องสร้างตารางใหม่
และสร้างใหม่ไม่ได้ง่าย ๆ เพราะมี FK จาก 4 ตารางชี้มาที่ Employee

**ทางออก:** ตอน start ให้ตรวจว่าตาราง Employee ที่มีอยู่มีคอลัมน์ `password_hash` หรือไม่

- ไม่มี → หยุดแล้วพิมพ์ข้อความชัดเจนว่าฐานข้อมูลเป็นเวอร์ชันเก่า ให้รัน `reset-db.bat`
- มี → ทำงานต่อตามปกติ

**ไม่ลบไฟล์ `.db` อัตโนมัติ** เพราะการลบข้อมูลโดยไม่ถามเป็นพฤติกรรมอันตราย
หากวันนั้นมีข้อมูลสาธิตที่เตรียมไว้จะหายทั้งหมด — สอดคล้องกับหลักที่ทีมยึดอยู่แล้วว่า
*`.sql` คือต้นฉบับความจริง / `.db` คือของใช้แล้วทิ้ง*

ฝั่งอาจารย์ไม่เจอปัญหานี้ เพราะแตก zip มาแล้วสร้าง DB ใหม่จาก `schema.sql` ที่ถูกต้องตั้งแต่แรก

---

## 5. โครงสร้างไฟล์

```
middlewares/                    ← โฟลเดอร์ใหม่
  auth.middleware.js            requireRole(role)
  customer.middleware.js        requireDiningSession()
  error.middleware.js           notFound() + errorHandler()
controllers/
  auth.controller.js            ← ใหม่: showLogin / login / logout
routes/
  auth.routes.js                ← ใหม่
views/
  auth/login.ejs                ← ใหม่
  partials/header.ejs           ← แก้: แสดงชื่อผู้ใช้ + ปุ่มออกจากระบบ
server.js                       ← แก้: secret, mount guard, error handler
database/schema.sql             ← แก้: password_hash + ADMIN
database/seed.sql               ← แก้: hash + บัญชี admin
start.bat / reset-db.bat        ← ใหม่
```

แยก `middlewares/` ออกจาก `controllers/` ตามแพตเทิร์นเดิมของโปรเจกต์ที่แยก
`routes/` `controllers/` `utils/` ไว้ชัดเจนอยู่แล้ว

---

## 6. กลไกการยืนยันตัวตน

### 6.1 cookie แยกตาม role

```
ชื่อ:   staff_ADMIN | staff_CASHIER | staff_KITCHEN | staff_SERVICE
ค่า:    employee_id (เซ็นชื่อด้วย cookie-parser secret)
ออปชัน: httpOnly: true, signed: true, sameSite: 'Strict', secure: false, maxAge: 12 ชั่วโมง
```

ชื่อ cookie ไม่ชนกัน → ล็อกอินครบทุกบทบาทค้างไว้พร้อมกันในเบราว์เซอร์เดียวได้ (D3)

`secure: false` จำเป็น เพราะตอนตรวจรันบน `http://localhost` ถ้าตั้ง `true` เบราว์เซอร์จะไม่ส่ง cookie เลย

### 6.2 ตรรกะของ `requireRole('KITCHEN')`

```
1. อ่าน signed cookie "staff_KITCHEN"
   ├─ มี  → โหลดแถว Employee จาก DB → role ตรง → ผ่าน
   └─ ไม่มี ↓
2. อ่าน signed cookie "staff_ADMIN"
   ├─ มี  → โหลดแถว Employee จาก DB → role = ADMIN → ผ่าน
   └─ ไม่มี ↓
3. ปฏิเสธ (ดูข้อ 6.4 เรื่องรูปแบบการตอบ)
```

**โหลดแถว Employee จาก DB ใหม่ทุก request** ไม่เก็บ role ไว้ใน cookie เพราะ

- ถ้าแก้บทบาทหรือลบพนักงาน มีผลทันที ไม่ต้องรอ cookie หมดอายุ
- ไม่เอาข้อมูลจากฝั่ง client มาตัดสินสิทธิ์โดยตรง

เมื่อผ่านแล้ว middleware เซ็ตค่าไว้ 2 ที่

- `req.staff` — controller ใช้แทน `req.body.employee_id || 'EMP-001'` ที่ hardcode อยู่
- `res.locals.staff` — view ใช้แสดงชื่อบน navbar โดยไม่ต้องส่งผ่าน `render()` ทุกครั้ง

### 6.3 flow การเข้า/ออกระบบ

```
GET  /login     ฟอร์ม username + password
POST /login     หา Employee by username → bcrypt.compare(password, password_hash)
                สำเร็จ  → set cookie staff_<role> → redirect ตาม role
                           ADMIN, CASHIER → /cashier/tables
                           KITCHEN        → /kitchen
                           SERVICE        → /serving
                ล้มเหลว → render ฟอร์มพร้อมข้อความ "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
POST /logout    ลบ cookie เฉพาะ role ที่ระบุมา (แท็บ role อื่นไม่หลุด)
```

**การจัดการ `?next=`** — ถ้ามีพารามิเตอร์นี้ติดมา ให้ redirect ไปที่นั่นแทน URL ตาม role
แต่รับเฉพาะค่าที่ **ขึ้นต้นด้วย `/` ตัวเดียวและไม่ขึ้นต้นด้วย `//`** เท่านั้น
ถ้าไม่ผ่านเงื่อนไขให้ใช้ URL ตาม role แทน — กัน open redirect ที่พาผู้ใช้ออกไปเว็บนอก

**ที่มาของ role ตอน logout** — ฟอร์มออกจากระบบใน `header.ejs` ส่ง role ของหน้าที่กำลังใช้อยู่
มาเป็น hidden field โดยอ่านจาก `res.locals.staff.role` ที่ middleware เซ็ตไว้
เซิร์ฟเวอร์ลบเฉพาะ cookie ของ role นั้น หาก role ที่ส่งมาไม่อยู่ใน 4 ค่าที่รู้จัก ให้ไม่ลบอะไรเลย

ข้อความ error ตอน login ล้มเหลว **ไม่ระบุว่าผิดที่ username หรือ password**
เป็นแนวปฏิบัติมาตรฐานเพื่อกัน user enumeration

### 6.4 ตอบสนอง 2 รูปแบบ: หน้าเว็บ กับ AJAX

ระบบนี้เรียก API ด้วย `fetch()` + `res.json()` รวม 20 จุด
ถ้า guard สั่ง `res.redirect('/login')` กับ request จาก `fetch()` ฝั่งเบราว์เซอร์จะได้ HTML กลับไป
แล้ว `res.json()` จะพังด้วย `Unexpected token '<'` → **ปุ่มกดแล้วเงียบ ไม่มีอะไรเกิดขึ้น**
ซึ่งเป็นความเสี่ยงร้ายแรงถ้าเกิดตอนสาธิต

```js
const wantsHtml = (req.get('accept') || '').includes('text/html');

wantsHtml
  ? res.redirect('/login?next=' + encodeURIComponent(req.originalUrl))
  : res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
```

แยกได้แม่นเพราะการเปิดหน้าเว็บจาก address bar ส่ง `Accept: text/html` เสมอ
ส่วน `fetch()` ที่ไม่ได้ตั้ง Accept ส่ง `*/*`

โค้ดใน view เดิมเขียนว่า `if (!data.success) alert(data.message)` อยู่แล้ว
จึงเด้งข้อความภาษาไทยให้เอง **โดยไม่ต้องแก้ view สักไฟล์**

---

## 7. ตารางสิทธิ์

| เส้นทาง | ผู้เข้าถึงได้ |
|---|---|
| `/qr/:token`, `/menu`, `/orders` | ลูกค้า (ยืนยันด้วย qr_token ไม่ต้อง login) |
| `/login`, `/logout` | ทุกคน |
| `/cashier/**` (รวม `/cashier/queue/*`) | CASHIER, ADMIN |
| `/kitchen/**` | KITCHEN, ADMIN |
| `/serving/**` | SERVICE, ADMIN |
| `/` | redirect ไป `/login` |

### การติดตั้งใน server.js

```js
app.use('/kitchen', requireRole('KITCHEN'));
app.use('/serving', requireRole('SERVICE'));
app.use('/cashier', requireRole('CASHIER'));   // ครอบ /cashier/queue/* อัตโนมัติ

app.use('/', customerRoutes);                  // route เดิมทั้ง 5 ไฟล์ไม่ต้องแก้
app.use('/', kitchenRoutes);
app.use('/', servingRoutes);
app.use('/', cashierRoutes);
app.use('/', queueRoutes);
```

ดักที่ **path prefix ตอน mount** ไม่ใช่ `router.use()` ในแต่ละไฟล์ เพราะ

1. ไฟล์ `routes/*.js` ทั้ง 5 ไฟล์ไม่ต้องแก้เลย ลดโอกาสพังระหว่างทาง
2. `/cashier` ครอบ `queue.routes.js` ให้อัตโนมัติ (ทุก path เป็น `/cashier/queue/*`)
3. เลี่ยงบั๊ก: ถ้าใส่ `router.use()` ในไฟล์ URL ที่พิมพ์ผิดจะไหลผ่าน router ทีละตัว
   แล้วไปโดน guard ของครัวดักก่อน → เด้งไปหน้า login แทนที่จะขึ้น 404

**ข้อกำหนดที่ 1 (ลูกค้าเข้าหลังร้านไม่ได้) สำเร็จด้วย 3 บรรทัดนี้**

---

## 8. การจัดการข้อผิดพลาด

เพิ่ม 2 middleware ท้ายสุดของ `server.js` (ต้องอยู่หลัง route ทั้งหมด)

| middleware | หน้าที่ |
|---|---|
| `notFound()` | URL ไม่ตรงอะไรเลย → 404 (HTML ใช้ `error.ejs`, AJAX ใช้ JSON) |
| `errorHandler()` | ดัก error ที่หลุดมา → log ลง console + ตอบ 500 ตามรูปแบบเดียวกัน |

โปรเจกต์ใช้ **Express 5** ซึ่งส่ง error จาก async controller เข้า error handler ให้อัตโนมัติ
(Express 4 ทำไม่ได้) → `try/catch` ที่มีอยู่เดิมใน 5 controller ยังทำงานตามปกติ **ไม่ต้องรื้อ**
แต่โค้ดใหม่ไม่ต้องเขียนซ้ำอีก

---

## 9. ลดโค้ดซ้ำฝั่งลูกค้า

logic ตรวจ `qr_token` ถูก copy-paste อยู่ 3 ที่
(`customer.controller.js` บรรทัด 31, 73, 140) — ย้ายไปเป็น `requireDiningSession` ตัวเดียว
แล้วแปะไว้หน้า route ลูกค้า โดยเซ็ตผลลัพธ์ไว้ที่ `req.diningSession`

ได้ผลพลอยได้: controller ทั้ง 3 ตัวสั้นลง และมีตัวอย่าง "ก่อน/หลังใช้ middleware"
ที่เห็นภาพชัดสำหรับรายงานหัวข้อ *เทคนิคและวิธีการสร้างองค์ประกอบเว็บ*

---

## 10. ผลต่อ controller เดิม

แทนที่ fallback ที่ hardcode ด้วยค่าจริงจาก middleware

| ไฟล์ | เดิม | ใหม่ |
|---|---|---|
| `cashier.controller.js:43`, `:199` | `req.body.employee_id \|\| 'EMP-001'` | `req.staff.employee_id` |
| `kitchen.controller.js:63` | `req.body.employee_id \|\| 'EMP-002'` | `req.staff.employee_id` |
| `serving.controller.js:51` | `req.body.employee_id \|\| 'EMP-003'` | `req.staff.employee_id` |
| `queue.controller.js:126` | `req.body.employee_id \|\| 'EMP-001'` | `req.staff.employee_id` |

หลังแก้ ฐานข้อมูลจะบันทึกได้จริงว่าใครเปิดโต๊ะ ใครทำอาหาร ใครเสิร์ฟ ใครรับเงิน
ตามที่ schema ออกแบบ FK ไว้รองรับตั้งแต่แรก และ EMP-004 จะถูกใช้งานจริงเป็นครั้งแรก

---

## 11. ผลต่อการส่งงาน

| สิ่งที่ส่ง | ต้องทำอะไร |
|---|---|
| `README.txt` | ระบุ URL + username/password ของแต่ละ actor (เกณฑ์ข้อ (3) บังคับ) |
| Report.pdf | แก้ Data Dictionary ตาราง Employee, เพิ่มชั้น middleware ในหัวข้อสถาปัตยกรรม, เพิ่มหัวข้อ bcrypt และ signed cookie |
| Presentation.pdf | สาธิตการแยกสิทธิ์ตามบทบาทได้เป็นจุดขายใหม่ |
| `start.bat` | ยังเป็นคำสั่งเดียวเหมือนเดิม งานนี้ไม่เพิ่มขั้นตอนใด ๆ |
| `reset-db.bat` | ไฟล์ใหม่ สำหรับฐานข้อมูลเวอร์ชันเก่า (ข้อ 4.3) |

---

## 12. สิ่งที่ตั้งใจไม่ทำ

| ไม่ทำ | เหตุผล |
|---|---|
| หน้าจัดการพนักงานของ ADMIN | D2 — ADMIN แค่เข้าถึงได้ทุกหน้า ไม่มีหน้าใหม่ |
| หน้ารายงานยอดขาย | นอกขอบเขต เวลาจำกัด |
| `express-session` | เก็บ session ใน RAM → รีสตาร์ท server ตอนสาธิตแล้วหลุดหมด |
| `bcrypt` ตัวจริง (native) | ต้อง compile ด้วย node-gyp เสี่ยง `npm install` พังบนเครื่องอาจารย์ |
| ตาราง Session ในฐานข้อมูล | ต้องเพิ่มตารางที่ 13 เข้า Data Dictionary งานเยอะกว่าโดยไม่ได้ประโยชน์เพิ่ม |
| รื้อ `try/catch` เดิมออกทั้งหมด | ยังทำงานได้ ไม่คุ้มความเสี่ยงในช่วงใกล้ส่ง |
| ฟังก์ชันเปลี่ยนรหัสผ่าน | ไม่มีในข้อกำหนด |

---

## 13. ความเสี่ยงและการรับมือ

| ความเสี่ยง | การรับมือ |
|---|---|
| AJAX ได้ HTML แทน JSON ตอน session หมด | ตอบ 401 JSON แยกจาก redirect (ข้อ 6.4) |
| เพื่อนในทีมมี `.db` เวอร์ชันเก่า | Schema guard แจ้งข้อความชัดเจน + `reset-db.bat` (ข้อ 4.3) |
| สาธิตหลาย role พร้อมกันไม่ได้ | cookie แยกตาม role (ข้อ 6.1) |
| รีสตาร์ท server กลางสาธิตแล้วหลุด login | signed cookie ไม่เก็บ state ฝั่ง server |
| `npm install` พังบนเครื่องอาจารย์ | `bcryptjs` เป็น pure JS ไม่ต้อง compile |
| ลืมใส่ guard ตอนเพิ่ม route ใหม่ | ดักที่ path prefix ครอบทั้งกลุ่ม ไม่ใช่ทีละ endpoint |
| เอกสารไม่ตรงโค้ดตอนอาจารย์ตรวจ | อัปเดต Data Dictionary ใน Report (D1) |

---

## 14. เกณฑ์ว่างานนี้เสร็จ

1. ลูกค้าที่สแกน QR เข้า `/kitchen` `/serving` `/cashier/tables` ไม่ได้ ถูกเด้งไปหน้า login
2. บัญชี KITCHEN เข้า `/cashier/tables` ไม่ได้ และ `/serving` ไม่ได้
3. บัญชี ADMIN เข้าได้ครบทั้ง 3 ส่วน
4. ล็อกอิน 3 บทบาทพร้อมกันในเบราว์เซอร์เดียว แล้วสาธิต Socket.IO real-time ได้เหมือนเดิม
5. ฐานข้อมูลบันทึก `opened_by` `prepared_by` `served_by` `received_by` เป็นคนที่ล็อกอินจริง
6. กดปุ่มใด ๆ ขณะ session หมดอายุ แล้วได้ข้อความแจ้งเตือน ไม่ใช่เงียบหาย
7. ลบโฟลเดอร์ `data/` ทิ้ง แล้วรัน `start.bat` คำสั่งเดียว ใช้งานได้ครบ
8. รีสตาร์ท server แล้วแท็บที่ล็อกอินค้างไว้ยังใช้งานได้ต่อ
