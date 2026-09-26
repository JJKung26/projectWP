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
-- Upsert so renames and ordering changes reach existing databases
INSERT INTO Category (category_id, category_name, sort_order) VALUES
('CAT-MEAT', 'เนื้อสัตว์ & ทะเล', 1),
('CAT-VEG', 'ผักสด & เห็ด', 2),
('CAT-SNACK', 'ของทานเล่น', 3),
('CAT-NOODLE', 'ข้าว เส้น & ไข่', 4),
('CAT-DRINK', 'เครื่องดื่ม', 5),
('CAT-DESSERT', 'ของหวาน', 6)
ON CONFLICT(category_id) DO UPDATE SET
    category_name = excluded.category_name,
    sort_order = excluded.sort_order;

-- 4. Seed Menu Items (57 รายการ)
-- Upsert keeps availability untouched so the kitchen's stock switches survive a restart
INSERT INTO MenuItem (menu_item_id, category_id, item_name, description, charge_type, unit_price, availability, image_url) VALUES
-- เนื้อสัตว์ & ทะเล
('ITEM-101', 'CAT-MEAT', 'หมูสามชั้นสไลด์', 'สไลด์บาง มันแทรกพอดี ย่างแล้วกรอบนอกนุ่มใน', 'BUFFET', 0.0, 1, '/images/pork_belly.jpg'),
('ITEM-102', 'CAT-MEAT', 'สันคอหมูสไลด์', 'ส่วนคอหมู เนื้อนุ่มมีมันแทรก', 'BUFFET', 0.0, 1, '/images/pork_collar.jpg'),
('ITEM-103', 'CAT-MEAT', 'หมูหมักนุ่มรสเด็ด', 'หมักซอสสูตรร้าน หอมกระเทียม', 'BUFFET', 0.0, 1, '/images/marinated_pork.jpg'),
('ITEM-104', 'CAT-MEAT', 'หมูพริกไทยดำ', 'หมักพริกไทยดำ เผ็ดร้อนนิด ๆ', 'BUFFET', 0.0, 1, '/images/blackpepper_pork.jpg'),
('ITEM-105', 'CAT-MEAT', 'เบคอนสไลด์', 'เบคอนรมควัน ย่างให้กรอบ', 'BUFFET', 0.0, 1, '/images/bacon.jpg'),
('ITEM-106', 'CAT-MEAT', 'ตับหมูสด', 'ตับหมูสดใหม่ หั่นพอดีคำ', 'BUFFET', 0.0, 1, '/images/pork_liver.jpg'),
('ITEM-107', 'CAT-MEAT', 'เนื้อวัวพรีเมียมสไลด์', 'สไลด์บาง ลวกในน้ำซุปไม่กี่วินาที', 'BUFFET', 0.0, 1, '/images/sliced_beef.jpg'),
('ITEM-108', 'CAT-MEAT', 'กุ้งสดแกะเปลือก', 'กุ้งขาวแกะเปลือก ผ่าหลัง', 'BUFFET', 0.0, 1, '/images/shrimp.jpg'),
('ITEM-109', 'CAT-MEAT', 'ปลาหมึกกรอบ', 'ปลาหมึกหั่นวง เนื้อกรุบ', 'BUFFET', 0.0, 1, '/images/squid.jpg'),
('ITEM-110', 'CAT-MEAT', 'แมงกะพรุน', 'แมงกะพรุนเส้น เคี้ยวกรุบ', 'BUFFET', 0.0, 1, '/images/jellyfish.jpg'),
('ITEM-111', 'CAT-MEAT', 'ไก่หมักงา', 'สะโพกไก่หมักซอสงา', 'BUFFET', 0.0, 1, '/images/chicken_marinated.jpg'),
('ITEM-112', 'CAT-MEAT', 'ปีกไก่', 'ปีกกลางไก่ หมักเกลือพริกไทย', 'BUFFET', 0.0, 1, '/images/chicken_wings.jpg'),
('ITEM-113', 'CAT-MEAT', 'ปลาดอลลี่', 'เนื้อปลาขาว ไม่มีก้าง', 'BUFFET', 0.0, 1, '/images/dory.jpg'),
('ITEM-114', 'CAT-MEAT', 'หอยแมลงภู่', 'หอยสด ต้มในน้ำซุปได้เลย', 'BUFFET', 0.0, 1, '/images/mussels.jpg'),
('ITEM-115', 'CAT-MEAT', 'หอยแครง', 'ลวกแล้วจิ้มน้ำจิ้มซีฟู้ด', 'BUFFET', 0.0, 1, '/images/cockles.jpg'),
('ITEM-116', 'CAT-MEAT', 'ปลาหมึกหมักเสียบไม้', 'หมักซอส เสียบไม้พร้อมย่าง', 'BUFFET', 0.0, 1, '/images/squid_skewer.jpg'),
('ITEM-117', 'CAT-MEAT', 'เนื้อวัวย่างยากินิกุ', 'เนื้อติดมันหั่นหนา สำหรับย่าง', 'BUFFET', 0.0, 1, '/images/beef_yakiniku.jpg'),

-- ผักสด & เห็ด
('ITEM-201', 'CAT-VEG', 'ผักกาดขาว', 'ใส่ขอบกระทะ ซึมน้ำซุปหวาน', 'BUFFET', 0.0, 1, '/images/cabbage.jpg'),
('ITEM-202', 'CAT-VEG', 'ผักบุ้งจีน', 'ยอดอ่อน กรอบ', 'BUFFET', 0.0, 1, '/images/morning_glory.jpg'),
('ITEM-203', 'CAT-VEG', 'เห็ดเข็มทอง', 'มัดเป็นกำ ใส่น้ำซุป', 'BUFFET', 0.0, 1, '/images/enoki.jpg'),
('ITEM-204', 'CAT-VEG', 'เห็ดออรินจิ', 'หั่นแนวยาว ย่างได้ ต้มได้', 'BUFFET', 0.0, 1, '/images/eryngii.jpg'),
('ITEM-205', 'CAT-VEG', 'ข้าวโพดหวาน', 'หั่นท่อน ต้มในน้ำซุป', 'BUFFET', 0.0, 1, '/images/corn.jpg'),
('ITEM-206', 'CAT-VEG', 'วุ้นเส้น', 'แช่น้ำให้นุ่มแล้ว', 'BUFFET', 0.0, 1, '/images/glass_noodle.jpg'),
('ITEM-207', 'CAT-VEG', 'ผักกวางตุ้ง', 'ใบเขียว ก้านกรอบ', 'BUFFET', 0.0, 1, '/images/choy_sum.jpg'),
('ITEM-208', 'CAT-VEG', 'ผักกาดหอม', 'สำหรับห่อหมูย่าง', 'BUFFET', 0.0, 1, '/images/lettuce.jpg'),
('ITEM-209', 'CAT-VEG', 'เห็ดหอมสด', 'กลิ่นหอม เนื้อแน่น', 'BUFFET', 0.0, 1, '/images/shiitake.jpg'),
('ITEM-210', 'CAT-VEG', 'เห็ดฟาง', 'เห็ดฟางสด ต้มในน้ำซุป', 'BUFFET', 0.0, 1, '/images/straw_mushroom.jpg'),
('ITEM-211', 'CAT-VEG', 'แครอทหั่นแว่น', 'หวาน กรอบ', 'BUFFET', 0.0, 1, '/images/carrot.jpg'),
('ITEM-212', 'CAT-VEG', 'ข้าวโพดอ่อน', 'ฝักอ่อน กรอบหวาน', 'BUFFET', 0.0, 1, '/images/baby_corn.jpg'),
('ITEM-213', 'CAT-VEG', 'เต้าหู้ขาว', 'เต้าหู้เนื้อนิ่ม', 'BUFFET', 0.0, 1, '/images/silken_tofu.jpg'),

-- ของทานเล่น
('ITEM-301', 'CAT-SNACK', 'ลูกชิ้นปลาภูเก็ต', 'ลูกชิ้นปลาเนื้อเด้ง', 'BUFFET', 0.0, 1, '/images/fishball.jpg'),
('ITEM-302', 'CAT-SNACK', 'เต้าหู้ปลา', 'ทอดแล้ว ซึมน้ำซุป', 'BUFFET', 0.0, 1, '/images/fish_tofu.jpg'),
('ITEM-303', 'CAT-SNACK', 'ไส้กรอกไก่รมควัน', 'ย่างได้ ต้มได้', 'BUFFET', 0.0, 1, '/images/sausage.jpg'),
('ITEM-304', 'CAT-SNACK', 'ปูอัดอลาสก้า', 'ปูอัดแท่ง', 'BUFFET', 0.0, 1, '/images/crabstick.jpg'),
('ITEM-305', 'CAT-SNACK', 'เฟรนช์ฟรายส์ทอด', 'ทอดใหม่ทุกจาน', 'BUFFET', 0.0, 1, '/images/french_fries.jpg'),
('ITEM-306', 'CAT-SNACK', 'เกี๊ยวซ่าทอดกรอบ', 'ไส้หมู ทอดกรอบ', 'BUFFET', 0.0, 1, '/images/gyoza.jpg'),
('ITEM-307', 'CAT-SNACK', 'ลูกชิ้นหมู', 'ลูกชิ้นหมูเนื้อแน่น', 'BUFFET', 0.0, 1, '/images/pork_ball.jpg'),
('ITEM-308', 'CAT-SNACK', 'เต้าหู้ไข่ทอด', 'ทอดเหลือง กรอบนอก', 'BUFFET', 0.0, 1, '/images/egg_tofu.jpg'),
('ITEM-309', 'CAT-SNACK', 'ไก่ป๊อป', 'ไก่ทอดชิ้นเล็ก กรอบ', 'BUFFET', 0.0, 1, '/images/popcorn_chicken.jpg'),
('ITEM-310', 'CAT-SNACK', 'ปอเปี๊ยะทอด', 'ไส้ผักและวุ้นเส้น', 'BUFFET', 0.0, 1, '/images/spring_roll.jpg'),

-- ข้าว เส้น & ไข่
('ITEM-601', 'CAT-NOODLE', 'ข้าวสวย', 'ข้าวหอมมะลิ', 'BUFFET', 0.0, 1, '/images/rice.jpg'),
('ITEM-602', 'CAT-NOODLE', 'บะหมี่เหลือง', 'บะหมี่ไข่ ลวกในน้ำซุป', 'BUFFET', 0.0, 1, '/images/egg_noodle.jpg'),
('ITEM-603', 'CAT-NOODLE', 'บะหมี่กึ่งสำเร็จรูป', 'ใส่ปิดท้ายในน้ำซุปหมูกระทะ', 'BUFFET', 0.0, 1, '/images/instant_noodle.jpg'),
('ITEM-604', 'CAT-NOODLE', 'ไข่ไก่', 'ตอกใส่น้ำซุป หรือทำไข่ย่าง', 'BUFFET', 0.0, 1, '/images/egg.jpg'),

-- เครื่องดื่ม
('ITEM-401', 'CAT-DRINK', 'น้ำรีฟิล', 'ชาไทย น้ำหวาน เติมได้ไม่อั้น', 'BUFFET', 0.0, 1, '/images/drink_refill.jpg'),
('ITEM-402', 'CAT-DRINK', 'น้ำส้มคั้นสด (ขวด)', 'คั้นสด ไม่ผสมน้ำ', 'ALACARTE', 29.0, 1, '/images/orange_juice.jpg'),
('ITEM-403', 'CAT-DRINK', 'เบียร์สิงห์ (ขวดใหญ่)', 'ขวด 620 มล. แช่เย็น', 'ALACARTE', 90.0, 1, '/images/singha.jpg'),
('ITEM-404', 'CAT-DRINK', 'น้ำดื่ม (ขวด)', 'น้ำดื่มขวด 600 มล.', 'ALACARTE', 15.0, 1, '/images/water.jpg'),
('ITEM-405', 'CAT-DRINK', 'น้ำมะพร้าวอ่อน', 'มะพร้าวน้ำหอมทั้งลูก', 'ALACARTE', 45.0, 1, '/images/coconut.jpg'),
('ITEM-406', 'CAT-DRINK', 'น้ำอัดลม (แก้ว)', 'เสิร์ฟพร้อมน้ำแข็ง', 'ALACARTE', 25.0, 1, '/images/soda.jpg'),
('ITEM-407', 'CAT-DRINK', 'เบียร์ลีโอ (ขวดใหญ่)', 'ขวด 620 มล. แช่เย็น', 'ALACARTE', 85.0, 1, '/images/leo.jpg'),
('ITEM-408', 'CAT-DRINK', 'น้ำแข็ง (ถัง)', 'ถังน้ำแข็งประจำโต๊ะ', 'BUFFET', 0.0, 1, '/images/ice.jpg'),

-- ของหวาน
('ITEM-501', 'CAT-DESSERT', 'ไอศกรีมกะทิสด', 'กะทิสด หวานมัน', 'BUFFET', 0.0, 1, '/images/icecream.jpg'),
('ITEM-502', 'CAT-DESSERT', 'เฉาก๊วยชากังราว', 'เนื้อนุ่ม ราดน้ำเชื่อม', 'BUFFET', 0.0, 1, '/images/grass_jelly.jpg'),
('ITEM-503', 'CAT-DESSERT', 'ทับทิมกรอบ', 'แห้วห่อแป้งสีแดง ในน้ำกะทิ', 'BUFFET', 0.0, 1, '/images/tubtim.jpg'),
('ITEM-504', 'CAT-DESSERT', 'บัวลอย', 'แป้งปั้นหลากสี ในน้ำกะทิ', 'BUFFET', 0.0, 1, '/images/bualoy.jpg'),
('ITEM-505', 'CAT-DESSERT', 'ลอดช่อง', 'ลอดช่องใบเตย ในน้ำกะทิ', 'BUFFET', 0.0, 1, '/images/lodchong.jpg')
ON CONFLICT(menu_item_id) DO UPDATE SET
    category_id = excluded.category_id,
    item_name = excluded.item_name,
    description = excluded.description,
    charge_type = excluded.charge_type,
    unit_price = excluded.unit_price,
    image_url = excluded.image_url;

-- 5. Seed Service Types
INSERT OR IGNORE INTO ServiceType (service_type_id, service_name) VALUES
('SRV-01', 'ขอเปลี่ยนกระทะ / ตะแกรง'),
('SRV-02', 'ขอเติมถ่าน / ไฟดับ'),
('SRV-03', 'ขอน้ำจิ้มเพิ่ม'),
('SRV-04', 'ขอน้ำซุปเพิ่ม'),
('SRV-05', 'ขอเช็ด / ทำความสะอาดโต๊ะ');
