-- สร้างอัตโนมัติด้วย npm run seed:accounts — ห้ามแก้ไฟล์นี้ด้วยมือ
-- รหัสผ่านจริงดูได้ที่ scripts/generate-accounts.js และ README.txt

INSERT OR IGNORE INTO Employee (employee_id, username, password_hash, full_name, role) VALUES
('EMP-000', 'admin', '$2b$10$YjfQxoMG2oF06hSoscvftOvzaQBNtUyxuQ09EkxD/JHKkOSPgm2Te', 'ผู้ดูแลระบบ', 'ADMIN'),
('EMP-001', 'cashier1', '$2b$10$/OfG9CKUcat3nBb03fl8uOVxB9cew1EL76xr8QHIx8kc0z3wSIPje', 'แคชเชียร์ สมศรี', 'CASHIER'),
('EMP-002', 'kitchen1', '$2b$10$/8f.hJJkDB5hwrR3WE8hJ.0Zy7rbEinHYmb6nge0sEZ0IEOepd8lK', 'เชฟ สมชาย (ครัว)', 'KITCHEN'),
('EMP-003', 'service1', '$2b$10$/3Czid2xKbBUeN4hx0dnwOu5Szpn8U7JjFDJNmXv34QeLdVhsj0i.', 'พนักงานเสิร์ฟ นพ', 'SERVICE'),
('EMP-004', 'service2', '$2b$10$6zlzTL7Gl8GliCm/xxSp8.hcCy44M.5yMnrUCM92W1C/4BmQzubuu', 'พนักงานเสิร์ฟ ฝน', 'SERVICE');
