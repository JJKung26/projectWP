-- สร้างอัตโนมัติด้วย npm run seed:accounts — ห้ามแก้ไฟล์นี้ด้วยมือ
-- รหัสผ่านจริงดูได้ที่ scripts/generate-accounts.js และ README.txt

INSERT OR IGNORE INTO Employee (employee_id, username, password_hash, full_name, role) VALUES
('EMP-000', 'admin', '$2b$10$QNHpUKjBGGDBYxOJYOJ04eLtBdv9ZqVRvXTYB9.KISpEqWb7iF6je', 'ผู้ดูแลระบบ', 'ADMIN'),
('EMP-001', 'cashier1', '$2b$10$V7X9IJTeiC9zDuWST35gR.BlZA2C7IyWoQ/a4ue6k5bzjyGQBLcPu', 'แคชเชียร์ สมศรี', 'CASHIER'),
('EMP-002', 'kitchen1', '$2b$10$tKm31CDyfSqjAOFIKL6VBeJD5zw2JXHNE.HFH7PTad/Wy1OWsuQRe', 'เชฟ สมชาย (ครัว)', 'KITCHEN'),
('EMP-003', 'service1', '$2b$10$UuRz8FqFmyBB5HUyF2gxRuL0s4XYMLcKslBhsiWvcTXBj4Rc6dcI6', 'พนักงานเสิร์ฟ นพ', 'SERVICE'),
('EMP-004', 'service2', '$2b$10$kx71K.u6SYuFjxqDDhtPw.TY3/t.v8F1PIEN5cnt.5/Nqr7/RIF1y', 'พนักงานเสิร์ฟ ฝน', 'SERVICE'),
('EMP-005', 'cashier2', '$2b$10$26H4ZuKK3Ke0hN5B2h6mGuu07eITzgQRmR0cr82NHPrIq40KejVv.', 'แคชเชียร์ สมหญิง', 'CASHIER'),
('EMP-006', 'kitchen2', '$2b$10$OwQ2Wmve3u3stjOeIAwtQuSc0PKtSsmtJqJpuWo3fPKLQxyOJel22', 'เชฟ มานะ (ครัว)', 'KITCHEN');
