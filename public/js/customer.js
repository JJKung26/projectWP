// เลือกเมนู จัดตะกร้า ค้นหา และส่งออเดอร์ของลูกค้า
// ตะกร้าอาหาร
const STORE_KEY = 'cart:' + TOKEN;
// เก็บคำขอเดิมไว้ เมื่อไม่ได้รับคำตอบให้ลองส่งด้วย key เดิม
let cart = {};
try {
  cart = JSON.parse(readStorage(STORE_KEY)) || {};
} catch {}
// อ่านรายการที่ส่งค้างไว้ เพื่อให้ลองส่งรายการเดิมได้
function readPendingOrder() {
  try {
    const saved = JSON.parse(readStorage(STORE_KEY + ':pending'));
    if (!saved || typeof saved.key !== 'string') return null;
    const items = saved.items;
    if (!Array.isArray(items) || !items.length) return null;
    for (const item of items) {
      if (!item || typeof item.menu_item_id !== 'string') return null;
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return null;
    }
    return { key: saved.key, items };
  } catch {
    return null;
  }
}
let pendingOrder = readPendingOrder();
if (pendingOrder) {
  cart = {};
  for (const item of pendingOrder.items) {
    cart[item.menu_item_id] = item.quantity;
  }
} else {
  for (const id in cart) {
    if (!ITEMS[id] || !ITEMS[id].available) delete cart[id];
  }
}

// เก็บตะกร้าของโต๊ะนี้ไว้ในแท็บ
function save() {
  writeStorage(STORE_KEY, JSON.stringify(cart));
}

// เก็บหรือล้างรายการที่ยังไม่ได้รับคำตอบ
function savePending(order) {
  pendingOrder = order;
  writeStorage(STORE_KEY + ':pending', order ? JSON.stringify(order) : null);
}
const plusIcon =
  '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>';

// สร้างปุ่มเพิ่ม ลด หรือข้อความของหมดตามสถานะเมนู
function controlHtml(id) {
  if (!ITEMS[id]) return '<span>รายการจากคำขอเดิม</span>';
  if (!ITEMS[id].available) {
    let html = '<span>หมดชั่วคราว</span>';
    if (cart[id]) html += `<button onclick="setQty('${id}',0)">เอาออก</button>`;
    return html;
  }
  const quantity = cart[id] || 0;
  if (quantity === 0) {
    return `<button class="add-btn center" onclick="setQty('${id}', 1)" aria-label="เพิ่ม ${ITEMS[id].name}">${plusIcon}</button>`;
  }
  return `<div class="qty row">
        <button class="plain-button center" onclick="setQty('${id}', ${quantity - 1})" aria-label="ลด">−</button>
        <span class="digits">${quantity}</span>
        <button class="plain-button center" onclick="setQty('${id}', ${quantity + 1})" aria-label="เพิ่ม">+</button>
    </div>`;
}

// อัปเดตปุ่มจำนวนอาหารหนึ่งรายการ
function renderControl(id) {
  const control = document.querySelector(`.ctl[data-id="${id}"]`);
  if (control) control.innerHTML = controlHtml(id);
}

// เปลี่ยนจำนวนอาหารแล้วบันทึกและอัปเดตตะกร้า
function setQty(id, quantity) {
  if (window.orderSending || !ITEMS[id]) return;
  if (!ITEMS[id].available && quantity > 0) return;
  if (pendingOrder) return toast('กรุณาลองส่งรายการเดิมอีกครั้งก่อนแก้ตะกร้า', true);
  quantity = Math.max(0, Math.min(20, quantity));
  if (quantity === 0) {
    delete cart[id];
  } else {
    cart[id] = quantity;
  }
  save();
  renderControl(id);
  renderCart();
}

// นับจำนวน คำนวณยอด และสร้างรายการในลูปเดียว
function renderCart(showItems = false) {
  let count = 0;
  let extra = 0;
  let html = '';
  const show = showItems || byId('sheet').classList.contains('open');
  for (const id in cart) {
    const item = ITEMS[id] || { name: 'รายการจากคำขอเดิม', img: '', price: 0 };
    count += cart[id];
    extra += cart[id] * item.price;
    if (show) {
      let price = 'รวมในบุฟเฟต์';
      if (item.price) price = '฿' + item.price + ' / ชิ้น';
      html += `<div class="sheet-line row">
        <img src="${item.img}" alt="">
        <div class="nm">${item.name}<small>${price}</small></div>
        ${controlHtml(id)}
      </div>`;
    }
  }
  byId('cartCount').textContent = count;
  byId('cartExtra').textContent = extra > 0 ? `+฿${extra}` : '';
  byId('cartBar').classList.toggle('show', count > 0);
  if (show) {
    byId('sheetBody').innerHTML = html;
    byId('sheetExtra').textContent = '฿' + extra;
    if (count === 0) closeSheets();
  }
}

// ค้นหาและหน้าต่าง
function openSheet(id) {
  if (id === 'sheet') renderCart(true);
  dialogOpen(id, 'open');
}

// ปิดหน้าต่างตะกร้าและหมวดอาหาร
function closeSheets() {
  for (const sheet of document.querySelectorAll('.sheet.open')) dialogClose(sheet.id, 'open');
}

// ทำเครื่องหมายหมวดปัจจุบันแล้วเปิดรายการหมวด
function openCatSheet() {
  const active = document.querySelector('.category-tab.active');
  let current;
  if (active) current = active.dataset.cat;
  for (const link of document.querySelectorAll('.cat-list a')) {
    const on = link.dataset.cat === current;
    link.classList.toggle('current', on);
    link.querySelector('.tick').style.visibility = on ? 'visible' : 'hidden';
  }
  openSheet('catSheet');
}

// Search
function openSearch() {
  document.body.classList.add('searching');
  window.scrollTo(0, 0);
  byId('searchInput').focus();
}

// ล้างข้อความค้นหาแล้วกลับมาแสดงเมนูทั้งหมด
function closeSearch() {
  byId('searchInput').value = '';
  filterMenu('');
  document.body.classList.remove('searching');
}

// แสดงเฉพาะเมนูที่ชื่อตรงกับคำค้นหา
function filterMenu(query) {
  query = query.trim().toLowerCase();
  let any = false;
  for (const section of document.querySelectorAll('.menu-section')) {
    let shown = 0;
    for (const row of section.querySelectorAll('.menu-row')) {
      const hit = !query || row.dataset.name.toLowerCase().includes(query);
      row.style.display = hit ? '' : 'none';
      if (hit) shown++;
    }
    section.style.display = shown ? '' : 'none';
    any = any || shown > 0;
  }
  byId('noResult').style.display = any ? 'none' : 'block';
}
let toastTimer;

// แสดงข้อความแจ้งเตือนสั้น ๆ แล้วซ่อนเอง
function toast(msg, isError) {
  const notice = byId('toast');
  notice.textContent = msg;
  notice.classList.toggle('error', !!isError);
  notice.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => notice.classList.remove('show'), 2600);
}

// ส่งออเดอร์
async function submitOrder() {
  if (window.orderSending) return;
  let items = [];
  if (pendingOrder) {
    items = pendingOrder.items;
  } else {
    for (const id in cart) {
      items.push({ menu_item_id: id, quantity: cart[id] });
    }
  }
  if (items.length === 0) return;
  const btn = byId('sendBtn');
  window.orderSending = true;
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง…';
  try {
    // สร้างคำขอครั้งแรกเท่านั้น การลองส่งซ้ำใช้คำขอเดิม
    if (!pendingOrder) {
      const key = 'order-' + Date.now() + '-' + Math.floor(Math.random() * 1000000000);
      savePending({ items, key });
    }
    const data = await requestData('/orders', {
      token: TOKEN,
      items,
      request_key: pendingOrder.key
    });
    if (data.success) {
      cart = {};
      savePending(null);
      save();
      window.location.href = `/orders?token=${TOKEN}&sent=1`;
      return;
    }
    if (data.httpStatus < 500) savePending(null);
    toast(data.message || 'ส่งออเดอร์ไม่สำเร็จ', true);
  } catch {
    toast('ยังไม่ได้รับคำตอบ กดลองส่งรายการเดิมอีกครั้งได้', true);
  } finally {
    window.orderSending = false;
    btn.disabled = !!byId('diningEnded');
    btn.textContent = pendingOrder ? 'ลองส่งรายการเดิมอีกครั้ง' : 'ส่งออเดอร์เข้าครัว';
  }
}
// อัปเดตสต็อก
let stockLoading = false;
let latestOrder;

async function refreshStock() {
  if (stockLoading || byId('diningEnded')) return;
  stockLoading = true;
  try {
    const res = await requestFetch('/menu/data?token=' + TOKEN);
    if (res.status === 400) return diningEnded();
    if (!res.ok) throw Error('โหลดสต็อกไม่สำเร็จ');
    const data = await res.json();
    let changed = false;
    for (const item of data.menuItems) {
      const id = item.menu_item_id;
      const available = item.availability === 1;
      if (!ITEMS[id] || ITEMS[id].available === available) continue;
      ITEMS[id].available = available;
      const row = document.querySelector('.menu-row[data-id="' + id + '"]');
      if (row) {
        row.classList.toggle('sold-out', !available);
        const tag = row.querySelector('.sold-tag');
        if (tag) tag.hidden = available;
      }
      renderControl(id);
      changed = true;
    }
    if (latestOrder !== undefined && latestOrder !== data.latestOrder) {
      toast('มีออเดอร์ใหม่ของโต๊ะ ดูได้ในหน้าออเดอร์');
    }
    latestOrder = data.latestOrder;
    if (changed) renderCart();
  } catch {
    toast('อัปเดตสต็อกไม่ได้ กำลังลองเชื่อมต่อใหม่', true);
  } finally {
    stockLoading = false;
  }
}
// หมวดอาหารและเหตุการณ์
const tabs = document.querySelectorAll('.category-tab');
// เลือกแท็บหมวดตามส่วนเมนูที่เลื่อนมาถึง
function followCategory(entries) {
  if (document.body.classList.contains('searching')) return;
  for (const entry of entries) {
    if (entry.isIntersecting) selectCategory(entry.target.dataset.cat);
  }
}
// ทำเครื่องหมายหมวดที่เลือกและเลื่อนแท็บให้มองเห็น
function selectCategory(categoryId) {
  for (const tab of tabs) {
    const selected = tab.dataset.cat === categoryId;
    tab.classList.toggle('active', selected);
    if (!selected) continue;
    const strip = tab.parentElement;
    strip.scrollTo({
      left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2,
      behavior: 'smooth'
    });
  }
}
const observer = new IntersectionObserver(followCategory, { rootMargin: '-60px 0px -75% 0px' });
for (const section of document.querySelectorAll('.menu-section')) observer.observe(section);
for (const control of document.querySelectorAll('.ctl')) renderControl(control.dataset.id);
renderCart();
if (pendingOrder) byId('sendBtn').textContent = 'ลองส่งรายการเดิมอีกครั้ง';
setInterval(refreshStock, 5000);
