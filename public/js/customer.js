// เปิดและปิดป๊อปอัปตะกร้าหรือหมวดอาหาร
function openSheet(id) {
  dialogOpen(id, 'open');
}

function closeSheets() {
  const sheets = document.querySelectorAll('.sheet.open');
  for (const sheet of sheets) dialogClose(sheet.id, 'open');
}

// ทำเครื่องหมายหมวดที่กำลังดู ก่อนเปิดรายการหมวดทั้งหมด
function openCatSheet() {
  const current = document.querySelector('.category-tab.active').dataset.cat;
  const links = document.querySelectorAll('.cat-list a');
  for (const link of links) {
    link.classList.toggle('current', link.dataset.cat === current);
  }
  openSheet('catSheet');
}

// เปิดช่องค้นหาและล้างคำค้นเมื่อกดยกเลิก
function openSearch() {
  document.body.classList.add('searching');
  window.scrollTo(0, 0);
  byId('searchInput').focus();
}

function closeSearch() {
  byId('searchInput').value = '';
  filterMenu('');
  document.body.classList.remove('searching');
}

// แสดงเฉพาะอาหารที่ตรงคำค้น และซ่อนหมวดที่ไม่มีผลลัพธ์
function filterMenu(query) {
  const word = query.trim().toLowerCase();
  const sections = document.querySelectorAll('.menu-section');
  let total = 0;
  for (const section of sections) {
    let shown = 0;
    const rows = section.querySelectorAll('.menu-row');
    for (const row of rows) {
      const match = row.dataset.name.toLowerCase().includes(word);
      row.hidden = !match;
      if (match) shown++;
    }
    section.hidden = shown === 0;
    total += shown;
  }
  byId('noResult').hidden = total > 0;
}

// อ่านของหมดจากเซิร์ฟเวอร์ แล้วอัปเดตเมนูกับตะกร้า
async function refreshStock() {
  try {
    const data = await requestData('/menu/data?token=' + TOKEN);
    if (data.httpStatus === 400) {
      clearInterval(stockTimer);
      diningEnded();
      return;
    }
    if (!data.success) return;
    for (const item of data.menuItems) {
      const id = item.menu_item_id;
      ITEMS[id].available = item.availability === 1;
      const row = document.querySelector('.menu-row[data-id="' + id + '"]');
      row.classList.toggle('sold-out', !ITEMS[id].available);
      row.querySelector('.sold-tag').hidden = ITEMS[id].available;
      renderControl(id);
    }
    renderCart();
  } catch (error) {
    console.warn('อัปเดตเมนูไม่ได้:', error.message);
  }
}

// เมื่อหัวข้อหมวดเลื่อนเข้าหน้าจอ ให้เลือกแท็บหมวดนั้น
function updateCategory(entries) {
  if (document.body.classList.contains('searching')) return;
  const tabs = document.querySelectorAll('.category-tab');
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const tab of tabs) {
      const active = tab.dataset.cat === entry.target.dataset.cat;
      tab.classList.toggle('active', active);
      if (active) {
        const bar = tab.parentElement;
        const left = tab.offsetLeft - bar.clientWidth / 2 + tab.offsetWidth / 2;
        bar.scrollTo({ left, behavior: 'smooth' });
      }
    }
  }
}
// เริ่มติดตามหมวด แสดงจำนวนในตะกร้า และอัปเดตสต็อกทุก 5 วินาที
const observer = new IntersectionObserver(updateCategory, {
  rootMargin: '-60px 0px -75% 0px'
});
for (const section of document.querySelectorAll('.menu-section')) observer.observe(section);
for (const id in ITEMS) renderControl(id);
renderCart();
const stockTimer = setInterval(refreshStock, 5000);
