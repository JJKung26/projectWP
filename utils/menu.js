const db = require('../database/database');

// อ่านหมวดและอาหาร แล้วรวมอาหารไว้ในหมวดของตัวเอง
function menuContent() {
  const categories = db.query('SELECT * FROM Category ORDER BY sort_order, category_id');
  const menuItems = db.query(
    `SELECT * FROM MenuItem WHERE is_active = 1
      ORDER BY category_id, sort_order, menu_item_id`
  );
  // ใส่อาหารลงในหมวด และเก็บเฉพาะหมวดที่มีรายการ
  const sections = [];
  for (const category of categories) {
    category.items = menuItems.filter(function (item) {
      return item.category_id === category.category_id;
    });
    if (category.items.length) sections.push(category);
  }
  return { menuItems, sections };
}
module.exports = { menuContent };
