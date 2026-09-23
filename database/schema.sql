-- Foreign Key Enforcement for SQLite
PRAGMA foreign_keys = ON;

-- 1. Employee
CREATE TABLE IF NOT EXISTS Employee (
    employee_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('CASHIER', 'KITCHEN', 'SERVICE'))
);

-- 2. DiningTable (50 tables)
CREATE TABLE IF NOT EXISTS DiningTable (
    table_id TEXT PRIMARY KEY,
    table_no TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    table_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(table_status IN ('AVAILABLE', 'OCCUPIED', 'CLEANING'))
);

-- 3. QueueTicket
CREATE TABLE IF NOT EXISTS QueueTicket (
    queue_ticket_id TEXT PRIMARY KEY,
    queue_no TEXT NOT NULL,
    queue_date DATE NOT NULL,
    guest_count INTEGER NOT NULL,
    queue_status TEXT NOT NULL DEFAULT 'WAITING' CHECK(queue_status IN ('WAITING', 'CALLED', 'SEATED', 'CANCELLED'))
);

-- 4. DiningSession
CREATE TABLE IF NOT EXISTS DiningSession (
    session_id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES DiningTable(table_id),
    opened_by TEXT NOT NULL REFERENCES Employee(employee_id),
    queue_ticket_id TEXT UNIQUE REFERENCES QueueTicket(queue_ticket_id),
    qr_token TEXT UNIQUE NOT NULL,
    guest_count INTEGER NOT NULL,
    buffet_price REAL NOT NULL DEFAULT 279.00,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at DATETIME,
    session_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(session_status IN ('ACTIVE', 'CLOSED', 'CANCELLED'))
);

-- 5. Category
CREATE TABLE IF NOT EXISTS Category (
    category_id TEXT PRIMARY KEY,
    category_name TEXT UNIQUE NOT NULL
);

-- 6. MenuItem
CREATE TABLE IF NOT EXISTS MenuItem (
    menu_item_id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES Category(category_id),
    item_name TEXT NOT NULL,
    charge_type TEXT NOT NULL DEFAULT 'BUFFET' CHECK(charge_type IN ('BUFFET', 'ALACARTE')),
    unit_price REAL NOT NULL DEFAULT 0.0,
    availability INTEGER NOT NULL DEFAULT 1 CHECK(availability IN (0, 1)),
    image_url TEXT
);

-- 7. FoodOrder
CREATE TABLE IF NOT EXISTS FoodOrder (
    order_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES DiningSession(session_id),
    ordered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. OrderItem
CREATE TABLE IF NOT EXISTS OrderItem (
    order_item_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES FoodOrder(order_id) ON DELETE CASCADE,
    menu_item_id TEXT NOT NULL REFERENCES MenuItem(menu_item_id),
    prepared_by TEXT REFERENCES Employee(employee_id),
    served_by TEXT REFERENCES Employee(employee_id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price_at_order REAL NOT NULL DEFAULT 0.0,
    item_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(item_status IN ('PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED')),
    cancel_reason TEXT
);

-- 9. ServiceType
CREATE TABLE IF NOT EXISTS ServiceType (
    service_type_id TEXT PRIMARY KEY,
    service_name TEXT UNIQUE NOT NULL
);

-- 10. ServiceRequest
CREATE TABLE IF NOT EXISTS ServiceRequest (
    service_request_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES DiningSession(session_id),
    service_type_id TEXT NOT NULL REFERENCES ServiceType(service_type_id),
    completed_by TEXT REFERENCES Employee(employee_id),
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(request_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- 11. Bill
CREATE TABLE IF NOT EXISTS Bill (
    bill_id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL REFERENCES DiningSession(session_id),
    tax_amount REAL NOT NULL DEFAULT 0.0,
    net_amount REAL NOT NULL DEFAULT 0.0,
    bill_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(bill_status IN ('UNPAID', 'PAID', 'VOID')),
    receipt_no TEXT UNIQUE
);

-- 12. Payment
CREATE TABLE IF NOT EXISTS Payment (
    payment_id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES Bill(bill_id),
    received_by TEXT NOT NULL REFERENCES Employee(employee_id),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'PROMPTPAY', 'CREDIT_CARD')),
    amount REAL NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(payment_status IN ('SUCCESS', 'FAILED', 'CANCELLED'))
);
