-- Initial Seed Data for Moo Krata System

-- 1. Seed Employees → ย้ายไป seed-accounts.sql (สร้างด้วย npm run seed:accounts)

-- โต๊ะเริ่มต้น 50 โต๊ะสร้างด้วยลูปใน database.js

-- 3. Seed Food Categories
-- Upsert so renames and ordering changes reach existing databases
INSERT INTO Category (category_id, category_name, sort_order) VALUES
('CAT-MEAT', 'เนื้อสัตว์', 1),
('CAT-SEAFOOD', 'อาหารทะเล', 2),
('CAT-VEG', 'ผักและเห็ด', 3),
('CAT-BALL', 'ลูกชิ้นและเต้าหู้', 4),
('CAT-SNACK', 'ของทานเล่น', 5),
('CAT-NOODLE', 'ข้าว เส้น และไข่', 6),
('CAT-DRINK', 'เครื่องดื่ม', 7),
('CAT-DESSERT', 'ของหวาน', 8)
ON CONFLICT(category_id) DO UPDATE SET
    category_name = excluded.category_name,
    sort_order = excluded.sort_order;

-- 4. Seed Menu Items (56 รายการ)
-- Upsert keeps availability untouched so the kitchen's stock switches survive a restart
INSERT INTO MenuItem (menu_item_id, category_id, item_name, description, sort_order, charge_type, unit_price, availability, image_url) VALUES
-- เนื้อสัตว์
('ITEM-101', 'CAT-MEAT', 'หมูสามชั้นสไลด์', '', 1, 'BUFFET', 0.0, 1, '/images/pork_belly.png'),
('ITEM-102', 'CAT-MEAT', 'สันคอหมูสไลด์', '', 2, 'BUFFET', 0.0, 1, '/images/pork_collar.png'),
('ITEM-103', 'CAT-MEAT', 'หมูหมัก', '', 3, 'BUFFET', 0.0, 1, '/images/marinated_pork.png'),
('ITEM-104', 'CAT-MEAT', 'หมูหมักพริกไทยดำ', '', 4, 'BUFFET', 0.0, 1, '/images/blackpepper_pork.png'),
('ITEM-115', 'CAT-MEAT', 'หมูหมักงา', '', 5, 'BUFFET', 0.0, 1, '/images/marinated_pork_sesame.png'),
('ITEM-105', 'CAT-MEAT', 'เบคอน', '', 6, 'BUFFET', 0.0, 1, '/images/bacon.png'),
('ITEM-106', 'CAT-MEAT', 'ตับหมู', '', 7, 'BUFFET', 0.0, 1, '/images/pork_liver.png'),
('ITEM-107', 'CAT-MEAT', 'เนื้อวัวสไลด์', '', 8, 'BUFFET', 0.0, 1, '/images/sliced_beef_cutout.png'),
('ITEM-117', 'CAT-MEAT', 'เนื้อวัวหมัก', '', 9, 'BUFFET', 0.0, 1, '/images/marinated_beef.png'),
('ITEM-111', 'CAT-MEAT', 'ไก่หมักงา', '', 10, 'BUFFET', 0.0, 1, '/images/chicken_marinated_plate.png'),
('ITEM-112', 'CAT-MEAT', 'ปีกไก่', 'ปีกกลางไก่', 11, 'BUFFET', 0.0, 1, '/images/chicken_wings.png'),

-- อาหารทะเล
('ITEM-108', 'CAT-SEAFOOD', 'กุ้งสด', 'แกะเปลือก', 1, 'BUFFET', 0.0, 1, '/images/shrimp.png'),
('ITEM-116', 'CAT-SEAFOOD', 'ปลาหมึกสด', '', 2, 'BUFFET', 0.0, 1, '/images/fresh_squid.png'),
('ITEM-109', 'CAT-SEAFOOD', 'ปลาหมึกกรอบ', '', 3, 'BUFFET', 0.0, 1, '/images/crispy_squid_cutout.png'),
('ITEM-113', 'CAT-SEAFOOD', 'ปลาดอลลี่', '', 4, 'BUFFET', 0.0, 1, '/images/dory.png'),
('ITEM-114', 'CAT-SEAFOOD', 'หอยแมลงภู่', 'ติดเปลือกครึ่งฝา', 5, 'BUFFET', 0.0, 1, '/images/mussels.png'),
('ITEM-110', 'CAT-SEAFOOD', 'แมงกะพรุน', '', 6, 'BUFFET', 0.0, 1, '/images/jellyfish.png'),

-- ผักและเห็ด
('ITEM-201', 'CAT-VEG', 'ผักกาดขาว', '', 1, 'BUFFET', 0.0, 1, '/images/cabbage.png'),
('ITEM-202', 'CAT-VEG', 'ผักบุ้งจีน', '', 2, 'BUFFET', 0.0, 1, '/images/morning_glory_cutout.png'),
('ITEM-207', 'CAT-VEG', 'ผักกวางตุ้ง', '', 3, 'BUFFET', 0.0, 1, '/images/choy_sum.png'),
('ITEM-208', 'CAT-VEG', 'ผักกาดหอม', '', 4, 'BUFFET', 0.0, 1, '/images/lettuce.png'),
('ITEM-211', 'CAT-VEG', 'แครอท', '', 5, 'BUFFET', 0.0, 1, '/images/carrot.png'),
('ITEM-205', 'CAT-VEG', 'ข้าวโพดหวาน', '', 6, 'BUFFET', 0.0, 1, '/images/corn.png'),
('ITEM-212', 'CAT-VEG', 'ข้าวโพดอ่อน', '', 7, 'BUFFET', 0.0, 1, '/images/baby_corn.png'),
('ITEM-203', 'CAT-VEG', 'เห็ดเข็มทอง', '', 8, 'BUFFET', 0.0, 1, '/images/enoki_cutout.png'),
('ITEM-204', 'CAT-VEG', 'เห็ดออรินจิ', '', 9, 'BUFFET', 0.0, 1, '/images/eryngii_cutout.png'),
('ITEM-209', 'CAT-VEG', 'เห็ดหอม', '', 10, 'BUFFET', 0.0, 1, '/images/shiitake.png'),
('ITEM-210', 'CAT-VEG', 'เห็ดฟาง', '', 11, 'BUFFET', 0.0, 1, '/images/straw_mushroom.png'),

-- ลูกชิ้นและเต้าหู้
('ITEM-301', 'CAT-BALL', 'ลูกชิ้นปลา', '', 1, 'BUFFET', 0.0, 1, '/images/fishball.png'),
('ITEM-307', 'CAT-BALL', 'ลูกชิ้นหมู', '', 2, 'BUFFET', 0.0, 1, '/images/pork_ball.png'),
('ITEM-302', 'CAT-BALL', 'เต้าหู้ปลา', '', 3, 'BUFFET', 0.0, 1, '/images/fish_tofu.png'),
('ITEM-308', 'CAT-BALL', 'เต้าหู้ไข่', '', 4, 'BUFFET', 0.0, 1, '/images/egg_tofu.png'),
('ITEM-213', 'CAT-BALL', 'เต้าหู้ขาว', '', 5, 'BUFFET', 0.0, 1, '/images/silken_tofu.png'),
('ITEM-304', 'CAT-BALL', 'ปูอัด', '', 6, 'BUFFET', 0.0, 1, '/images/crabstick.png'),
('ITEM-303', 'CAT-BALL', 'ไส้กรอก', '', 7, 'BUFFET', 0.0, 1, '/images/sausage.png'),

-- ของทานเล่น
('ITEM-305', 'CAT-SNACK', 'เฟรนช์ฟรายส์', '', 1, 'BUFFET', 0.0, 1, '/images/french_fries.jpg'),
('ITEM-309', 'CAT-SNACK', 'ไก่ทอด', 'เนื้อไก่ทอดชิ้นเล็ก', 2, 'BUFFET', 0.0, 1, '/images/popcorn_chicken.jpg'),
('ITEM-306', 'CAT-SNACK', 'เกี๊ยวซ่าทอด', 'ไส้หมู', 3, 'BUFFET', 0.0, 1, '/images/gyoza.jpg'),
('ITEM-310', 'CAT-SNACK', 'ปอเปี๊ยะทอด', 'ไส้ผัก', 4, 'BUFFET', 0.0, 1, '/images/spring_roll.jpg'),

-- ข้าว เส้น และไข่
('ITEM-601', 'CAT-NOODLE', 'ข้าวสวย', 'ข้าวหอมมะลิ', 1, 'BUFFET', 0.0, 1, '/images/rice.jpg'),
('ITEM-206', 'CAT-NOODLE', 'วุ้นเส้น', '', 2, 'BUFFET', 0.0, 1, '/images/glass_noodle.png'),
('ITEM-602', 'CAT-NOODLE', 'บะหมี่เหลือง', 'เส้นบะหมี่ไข่', 3, 'BUFFET', 0.0, 1, '/images/egg_noodle.png'),
('ITEM-603', 'CAT-NOODLE', 'บะหมี่กึ่งสำเร็จรูป', '', 4, 'BUFFET', 0.0, 1, '/images/instant_noodle.png'),
('ITEM-604', 'CAT-NOODLE', 'ไข่ไก่', '', 5, 'BUFFET', 0.0, 1, '/images/egg.png'),

-- เครื่องดื่ม
('ITEM-401', 'CAT-DRINK', 'น้ำรีฟิล', 'น้ำชา น้ำหวาน และน้ำอัดลม เติมได้', 1, 'BUFFET', 0.0, 1, '/images/drink_refill.png'),
('ITEM-404', 'CAT-DRINK', 'น้ำดื่ม (ขวด)', '', 2, 'ALACARTE', 15.0, 1, '/images/water.png'),
('ITEM-402', 'CAT-DRINK', 'น้ำส้ม (ขวด)', '', 3, 'ALACARTE', 29.0, 1, '/images/orange_juice.png'),
('ITEM-405', 'CAT-DRINK', 'น้ำมะพร้าว', '', 4, 'ALACARTE', 45.0, 1, '/images/coconut.png'),
('ITEM-408', 'CAT-DRINK', 'น้ำแข็ง (ถัง)', '', 5, 'BUFFET', 0.0, 1, '/images/ice.png'),
('ITEM-403', 'CAT-DRINK', 'เบียร์สิงห์ (ขวดใหญ่)', '', 6, 'ALACARTE', 90.0, 1, '/images/singha.png'),
('ITEM-407', 'CAT-DRINK', 'เบียร์ลีโอ (ขวดใหญ่)', '', 7, 'ALACARTE', 85.0, 1, '/images/leo.png'),

-- ของหวาน
('ITEM-501', 'CAT-DESSERT', 'ไอศกรีมกะทิ', '', 1, 'BUFFET', 0.0, 1, '/images/icecream.png'),
('ITEM-504', 'CAT-DESSERT', 'วุ้นกะทิ', '', 2, 'BUFFET', 0.0, 1, '/images/coconut_jelly_cutout.png'),
('ITEM-502', 'CAT-DESSERT', 'เฉาก๊วย', 'น้ำเชื่อม', 3, 'BUFFET', 0.0, 1, '/images/grass_jelly.png'),
('ITEM-503', 'CAT-DESSERT', 'ทับทิมกรอบ', 'น้ำกะทิ', 4, 'BUFFET', 0.0, 1, '/images/tubtim_bowl.png'),
('ITEM-505', 'CAT-DESSERT', 'ลอดช่อง', 'น้ำกะทิ', 5, 'BUFFET', 0.0, 1, '/images/lodchong.png')
ON CONFLICT(menu_item_id) DO UPDATE SET
    category_id = excluded.category_id,
    item_name = excluded.item_name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    charge_type = excluded.charge_type,
    unit_price = excluded.unit_price,
    image_url = excluded.image_url;

-- น้ำอัดลมรวมอยู่ในน้ำรีฟิลแล้ว เก็บแถวเดิมไว้สำหรับประวัติออเดอร์
UPDATE MenuItem SET is_active = 0, availability = 0, image_url = '/images/drink_refill.png' WHERE menu_item_id = 'ITEM-406';
