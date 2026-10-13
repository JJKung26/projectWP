// อ่านเมนูและจัดกลุ่มอาหารตามหมวด
const db = require('../database/database');

// อ่านหมวดและเมนูที่เปิดใช้งาน แล้วรวมเป็นแต่ละหมวด
async function menuContent() {
  const categories = await db.query(
    'SELECT * FROM Category ORDER BY sort_order ASC, category_id ASC'
  );
  const menuItems = await db.query(
    'SELECT * FROM MenuItem WHERE is_active = 1 ORDER BY category_id, COALESCE(sort_order, 0), menu_item_id'
  );
  const sections = [];
  for (const category of categories) {
    const items = menuItems.filter((item) => item.category_id === category.category_id);
    if (items.length) sections.push({ ...category, items });
  }
  return { categories, menuItems, sections };
}
module.exports = { menuContent };
