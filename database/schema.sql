-- สร้างตารางและความสัมพันธ์; controller ตรวจจำนวนและสถานะก่อนบันทึก
PRAGMA foreign_keys = ON;

-- เก็บบัญชีพนักงาน รหัสผ่านที่เข้ารหัส และหน้าที่
CREATE TABLE IF NOT EXISTS Employee (
    employee_id   TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL
);

-- เก็บหมายเลขโต๊ะ ความจุ และสถานะว่างหรือมีลูกค้า
CREATE TABLE IF NOT EXISTS DiningTable (
    table_id TEXT PRIMARY KEY,
    table_no TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    table_status TEXT NOT NULL DEFAULT 'AVAILABLE'
);

-- เก็บบัตรคิว วันที่ จำนวนลูกค้า และสถานะคิว
CREATE TABLE IF NOT EXISTS QueueTicket (
    queue_ticket_id TEXT PRIMARY KEY,
    queue_no TEXT NOT NULL,
    queue_date DATE NOT NULL,
    guest_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    queue_status TEXT NOT NULL DEFAULT 'WAITING'
);

-- เก็บรอบบริการของโต๊ะ จำนวนลูกค้า ราคา และรหัส QR
CREATE TABLE IF NOT EXISTS DiningSession (
    session_id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES DiningTable(table_id),
    opened_by TEXT NOT NULL REFERENCES Employee(employee_id),
    queue_ticket_id TEXT UNIQUE REFERENCES QueueTicket(queue_ticket_id),
    qr_token TEXT UNIQUE NOT NULL,
    guest_count INTEGER NOT NULL,
    buffet_price REAL NOT NULL DEFAULT 279.00,
    child_count INTEGER NOT NULL DEFAULT 0,
    free_child_count INTEGER NOT NULL DEFAULT 0,
    child_price REAL NOT NULL DEFAULT 179.00,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at DATETIME,
    session_status TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- เก็บชื่อหมวดอาหารและลำดับแสดงผล
CREATE TABLE IF NOT EXISTS Category (
    category_id TEXT PRIMARY KEY,
    category_name TEXT UNIQUE NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- เก็บชื่ออาหาร ราคา รูปภาพ และสถานะของหมด
CREATE TABLE IF NOT EXISTS MenuItem (
    menu_item_id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES Category(category_id),
    item_name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    charge_type TEXT NOT NULL DEFAULT 'BUFFET',
    unit_price REAL NOT NULL DEFAULT 0.0,
    availability INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    image_url TEXT
);

-- เก็บออเดอร์ที่ลูกค้าส่งในแต่ละรอบ
CREATE TABLE IF NOT EXISTS FoodOrder (
    order_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES DiningSession(session_id),
    request_key TEXT,
    round_no INTEGER,
    ordered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- เก็บอาหารในออเดอร์ จำนวน ราคา ณ ตอนสั่ง และสถานะ
CREATE TABLE IF NOT EXISTS OrderItem (
    order_item_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES FoodOrder(order_id) ON DELETE CASCADE,
    menu_item_id TEXT NOT NULL REFERENCES MenuItem(menu_item_id),
    prepared_by TEXT REFERENCES Employee(employee_id),
    served_by TEXT REFERENCES Employee(employee_id),
    quantity INTEGER NOT NULL,
    unit_price_at_order REAL NOT NULL DEFAULT 0.0,
    item_name_at_order TEXT,
    charge_type_at_order TEXT,
    item_status TEXT NOT NULL DEFAULT 'PENDING',
    cancel_reason TEXT
);

-- เก็บยอดบิลและเลขใบเสร็จของรอบบริการ
CREATE TABLE IF NOT EXISTS Bill (
    bill_id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL REFERENCES DiningSession(session_id),
    subtotal REAL,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    before_rounding REAL,
    rounding_amount REAL,
    net_amount REAL NOT NULL DEFAULT 0.0,
    snapshot_json TEXT,
    bill_status TEXT NOT NULL DEFAULT 'UNPAID',
    receipt_no TEXT UNIQUE
);

-- เก็บช่องทางชำระ ยอดรับ และพนักงานผู้รับเงิน
CREATE TABLE IF NOT EXISTS Payment (
    payment_id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES Bill(bill_id),
    received_by TEXT NOT NULL REFERENCES Employee(employee_id),
    payment_method TEXT NOT NULL,
    amount REAL NOT NULL,
    amount_received REAL,
    change_amount REAL,
    paid_at TEXT,
    payment_status TEXT NOT NULL DEFAULT 'SUCCESS'
);

-- ป้องกันเปิดโต๊ะ ออกเลขคิว ส่งออเดอร์ และรับเงินซ้ำ
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session ON DiningSession(table_id)
    WHERE session_status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_queue ON QueueTicket(queue_date, queue_no);
CREATE UNIQUE INDEX IF NOT EXISTS unique_order_request ON FoodOrder(session_id, request_key);
CREATE UNIQUE INDEX IF NOT EXISTS one_success_payment ON Payment(bill_id)
    WHERE payment_status = 'SUCCESS';
-- ช่วยค้นหาออเดอร์และรายการอาหารของแต่ละโต๊ะ
CREATE INDEX IF NOT EXISTS orders_by_session ON FoodOrder(session_id);
CREATE INDEX IF NOT EXISTS items_by_order ON OrderItem(order_id);
