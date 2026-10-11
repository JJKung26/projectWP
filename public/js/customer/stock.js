let stockTimer,
    stockLoading = false,
    stockAgain = false,
    stockDelay = 2000;
async function refreshStock() {
    if (stockLoading) {
        stockAgain = true;
        return;
    }
    stockLoading = true;
    clearTimeout(stockTimer);
    try {
        const res = await requestFetch('/menu/data?token=' + TOKEN);
        if (res.status === 400) return diningEnded();
        if (!res.ok) throw new Error();
        const data = await res.json();
        data.menuItems.forEach(item => {
            if (!ITEMS[item.menu_item_id]) return;
            ITEMS[item.menu_item_id].available = item.availability === 1;
            const row = document.querySelector('.menu-row[data-id="' + item.menu_item_id + '"]');
            row?.classList.toggle('sold-out', !item.availability);
            const tag = row?.querySelector('.sold-tag');
            if (tag) tag.hidden = !!item.availability;
            renderControl(item.menu_item_id);
        });
        stockDelay = 2000;
        if (document.getElementById('sheet').classList.contains('open')) renderSheet();
    } catch (err) {
        toast('อัปเดตสต็อกไม่ได้ กำลังลองเชื่อมต่อใหม่', true);
        stockTimer = setTimeout(refreshStock, stockDelay);
        stockDelay = Math.min(stockDelay * 2, 10000);
    } finally {
        stockLoading = false;
        if (stockAgain) {
            stockAgain = false;
            clearTimeout(stockTimer);
            stockTimer = setTimeout(refreshStock, 350);
        }
    }
}
