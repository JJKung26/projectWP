const db = require('../database/database');

async function menuContent() {
    const categories = await db.query(
        'SELECT * FROM Category ORDER BY sort_order ASC, category_id ASC'
    );
    const menuItems = await db.query(
        'SELECT * FROM MenuItem WHERE is_active = 1 ORDER BY category_id ASC, menu_item_id ASC'
    );
    return { categories, menuItems };
}

module.exports = { menuContent };
