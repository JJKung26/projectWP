-- Initial Seed Data for Moo Krata System

-- 1. Seed Employees
INSERT OR IGNORE INTO Employee (employee_id, username, full_name, role) VALUES
('EMP-001', 'cashier1', 'แคชเชียร์ สมศรี', 'CASHIER'),
('EMP-002', 'kitchen1', 'เชฟ สมชาย (ครัว)', 'KITCHEN'),
('EMP-003', 'service1', 'พนักงานเสิร์ฟ นพ', 'SERVICE'),
('EMP-004', 'service2', 'พนักงานเสิร์ฟ ฝน', 'SERVICE');

-- 2. Seed 50 Dining Tables
INSERT OR IGNORE INTO DiningTable (table_id, table_no, capacity, table_status) VALUES
('TBL-01', '1', 4, 'AVAILABLE'),
('TBL-02', '2', 4, 'AVAILABLE'),
('TBL-03', '3', 4, 'AVAILABLE'),
('TBL-04', '4', 4, 'AVAILABLE'),
('TBL-05', '5', 6, 'AVAILABLE'),
('TBL-06', '6', 4, 'AVAILABLE'),
('TBL-07', '7', 4, 'AVAILABLE'),
('TBL-08', '8', 4, 'AVAILABLE'),
('TBL-09', '9', 4, 'AVAILABLE'),
('TBL-10', '10', 8, 'AVAILABLE'),
('TBL-11', '11', 4, 'AVAILABLE'),
('TBL-12', '12', 4, 'AVAILABLE'),
('TBL-13', '13', 4, 'AVAILABLE'),
('TBL-14', '14', 4, 'AVAILABLE'),
('TBL-15', '15', 6, 'AVAILABLE'),
('TBL-16', '16', 4, 'AVAILABLE'),
('TBL-17', '17', 4, 'AVAILABLE'),
('TBL-18', '18', 4, 'AVAILABLE'),
('TBL-19', '19', 4, 'AVAILABLE'),
('TBL-20', '20', 8, 'AVAILABLE'),
('TBL-21', '21', 4, 'AVAILABLE'),
('TBL-22', '22', 4, 'AVAILABLE'),
('TBL-23', '23', 4, 'AVAILABLE'),
('TBL-24', '24', 4, 'AVAILABLE'),
('TBL-25', '25', 6, 'AVAILABLE'),
('TBL-26', '26', 4, 'AVAILABLE'),
('TBL-27', '27', 4, 'AVAILABLE'),
('TBL-28', '28', 4, 'AVAILABLE'),
('TBL-29', '29', 4, 'AVAILABLE'),
('TBL-30', '30', 8, 'AVAILABLE'),
('TBL-31', '31', 4, 'AVAILABLE'),
('TBL-32', '32', 4, 'AVAILABLE'),
('TBL-33', '33', 4, 'AVAILABLE'),
('TBL-34', '34', 4, 'AVAILABLE'),
('TBL-35', '35', 6, 'AVAILABLE'),
('TBL-36', '36', 4, 'AVAILABLE'),
('TBL-37', '37', 4, 'AVAILABLE'),
('TBL-38', '38', 4, 'AVAILABLE'),
('TBL-39', '39', 4, 'AVAILABLE'),
('TBL-40', '40', 8, 'AVAILABLE'),
('TBL-41', '41', 4, 'AVAILABLE'),
('TBL-42', '42', 4, 'AVAILABLE'),
('TBL-43', '43', 4, 'AVAILABLE'),
('TBL-44', '44', 4, 'AVAILABLE'),
('TBL-45', '45', 6, 'AVAILABLE'),
('TBL-46', '46', 4, 'AVAILABLE'),
('TBL-47', '47', 4, 'AVAILABLE'),
('TBL-48', '48', 4, 'AVAILABLE'),
('TBL-49', '49', 4, 'AVAILABLE'),
('TBL-50', '50', 10, 'AVAILABLE');

-- 3. Seed Food Categories
INSERT OR IGNORE INTO Category (category_id, category_name) VALUES
('CAT-MEAT', 'เนื้อสัตว์ & ทะเล'),
('CAT-VEG', 'ผักสด & เห็ด'),
('CAT-SNACK', 'ของทานเล่น & อาหารแปรรูป'),
('CAT-DRINK', 'เครื่องดื่ม'),
('CAT-DESSERT', 'ของหวาน');

-- 4. Seed Menu Items
INSERT OR IGNORE INTO MenuItem (menu_item_id, category_id, item_name, charge_type, unit_price, availability, image_url) VALUES
-- เนื้อสัตว์ (Buffet 0 บาท)
('ITEM-101', 'CAT-MEAT', 'หมูสามชั้นสไลด์', 'BUFFET', 0.0, 1, '/images/pork_belly.jpg'),
('ITEM-102', 'CAT-MEAT', 'สันคอหมูสไลด์', 'BUFFET', 0.0, 1, '/images/pork_collar.jpg'),
('ITEM-103', 'CAT-MEAT', 'หมูหมักนุ่มรสเด็ด', 'BUFFET', 0.0, 1, '/images/marinated_pork.jpg'),
('ITEM-104', 'CAT-MEAT', 'หมูพริกไทยดำ', 'BUFFET', 0.0, 1, '/images/blackpepper_pork.jpg'),
('ITEM-105', 'CAT-MEAT', 'เบคอนสไลด์', 'BUFFET', 0.0, 1, '/images/bacon.jpg'),
('ITEM-106', 'CAT-MEAT', 'ตับหมูสด', 'BUFFET', 0.0, 1, '/images/pork_liver.jpg'),
('ITEM-107', 'CAT-MEAT', 'เนื้อวัวพรีเมียมสไลด์', 'BUFFET', 0.0, 1, '/images/sliced_beef.jpg'),
('ITEM-108', 'CAT-MEAT', 'กุ้งสดแกะเปลือก', 'BUFFET', 0.0, 1, '/images/shrimp.jpg'),
('ITEM-109', 'CAT-MEAT', 'ปลาหมึกกรอบ', 'BUFFET', 0.0, 1, '/images/squid.jpg'),
('ITEM-110', 'CAT-MEAT', 'แมงกะพรุน', 'BUFFET', 0.0, 1, '/images/jellyfish.jpg'),

-- ผักสด & เห็ด (Buffet 0 บาท)
('ITEM-201', 'CAT-VEG', 'ผักกาดขาว', 'BUFFET', 0.0, 1, '/images/cabbage.jpg'),
('ITEM-202', 'CAT-VEG', 'ผักบุ้งจีน', 'BUFFET', 0.0, 1, '/images/morning_glory.jpg'),
('ITEM-203', 'CAT-VEG', 'เห็ดเข็มทอง', 'BUFFET', 0.0, 1, '/images/enoki.jpg'),
('ITEM-204', 'CAT-VEG', 'เห็ดออรินจิ', 'BUFFET', 0.0, 1, '/images/eryngii.jpg'),
('ITEM-205', 'CAT-VEG', 'ข้าวโพดหวาน', 'BUFFET', 0.0, 1, '/images/corn.jpg'),
('ITEM-206', 'CAT-VEG', 'วุ้นเส้น', 'BUFFET', 0.0, 1, '/images/glass_noodle.jpg'),

-- ของทานเล่น & แปรรูป (Buffet 0 บาท)
('ITEM-301', 'CAT-SNACK', 'ลูกชิ้นปลาภูเก็ต', 'BUFFET', 0.0, 1, '/images/fishball.jpg'),
('ITEM-302', 'CAT-SNACK', 'เต้าหู้ปลา', 'BUFFET', 0.0, 1, '/images/fish_tofu.jpg'),
('ITEM-303', 'CAT-SNACK', 'ไส้กรอกไก่รมควัน', 'BUFFET', 0.0, 1, '/images/sausage.jpg'),
('ITEM-304', 'CAT-SNACK', 'ปูอัดอลาสก้า', 'BUFFET', 0.0, 1, '/images/crabstick.jpg'),
('ITEM-305', 'CAT-SNACK', 'เฟรนช์ฟรายส์ทอด', 'BUFFET', 0.0, 1, '/images/french_fries.jpg'),
('ITEM-306', 'CAT-SNACK', 'เกี๊ยวซ่าทอดกรอบ', 'BUFFET', 0.0, 1, '/images/gyoza.jpg'),

-- เครื่องดื่ม & อะลาคาร์ทพิเศษ (Alacarte มีราคาพิเศษ หรือ Buffet)
('ITEM-401', 'CAT-DRINK', 'น้ำรีฟิล (รวมในบุฟเฟต์)', 'BUFFET', 0.0, 1, '/images/drink_refill.jpg'),
('ITEM-402', 'CAT-DRINK', 'น้ำส้มคั้นสด (ขวด)', 'ALACARTE', 29.0, 1, '/images/orange_juice.jpg'),
('ITEM-403', 'CAT-DRINK', 'เบียร์สิงห์ (ขวดใหญ่)', 'ALACARTE', 90.0, 1, '/images/singha.jpg'),

-- ของหวาน (Buffet 0 บาท)
('ITEM-501', 'CAT-DESSERT', 'ไอศกรีมกะทิสด', 'BUFFET', 0.0, 1, '/images/icecream.jpg'),
('ITEM-502', 'CAT-DESSERT', 'เฉาก๊วยชากังราว', 'BUFFET', 0.0, 1, '/images/grass_jelly.jpg');

-- 5. Seed Service Types
INSERT OR IGNORE INTO ServiceType (service_type_id, service_name) VALUES
('SRV-01', 'ขอเปลี่ยนกระทะ / ตะแกรง'),
('SRV-02', 'ขอเติมถ่าน / ไฟดับ'),
('SRV-03', 'ขอน้ำจิ้มเพิ่ม'),
('SRV-04', 'ขอน้ำซุปเพิ่ม'),
('SRV-05', 'ขอเช็ด / ทำความสะอาดโต๊ะ');
