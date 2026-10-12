// ตะกร้าอาหาร
const STORE_KEY = 'cart:' + TOKEN;
// เก็บคำขอเดิมไว้ เมื่อไม่ได้รับคำตอบให้ลองส่งด้วย key เดิม
let cart = {};
try {
  cart = JSON.parse(readStorage(STORE_KEY)) || {};
} catch {
  cart = {};
}
function readPendingOrder() {
  try {
    const saved = JSON.parse(readStorage(STORE_KEY + ':pending'));
    if (!saved || typeof saved.key !== 'string') {
      return null;
    }
    // อ่านข้อมูลรุ่นเก่าที่เก็บรายการเป็นข้อความได้ด้วย
    const items = saved.payload === undefined ? saved.items : JSON.parse(saved.payload);
    if (!Array.isArray(items) || !items.length) {
      return null;
    }
    for (const item of items) {
      if (typeof item.menu_item_id !== 'string' || !Number.isInteger(item.quantity)) {
        return null;
      }
      if (item.quantity < 1 || item.quantity > 20) {
        return null;
      }
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
  for (const id of Object.keys(cart)) {
    if (!ITEMS[id] || !ITEMS[id].available) {
      delete cart[id];
    }
  }
}

function save() {
  writeStorage(STORE_KEY, JSON.stringify(cart));
}

function savePending(order) {
  pendingOrder = order;
  writeStorage(STORE_KEY + ':pending', order ? JSON.stringify(order) : null);
}
const plusIcon =
  '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>';

function controlHtml(id) {
  if (!ITEMS[id]) {
    return '<span>รายการจากคำขอเดิม</span>';
  }
  if (!ITEMS[id].available) {
    return (
      '<span>หมดชั่วคราว</span>' +
      (cart[id] ? `<button onclick="setQty('${id}',0)">เอาออก</button>` : '')
    );
  }
  const q = cart[id] || 0;
  if (q === 0) {
    return `<button class="add-btn" onclick="setQty('${id}', 1)" aria-label="เพิ่ม ${ITEMS[id].name}">${plusIcon}</button>`;
  }
  return `<div class="qty">
        <button onclick="setQty('${id}', ${q - 1})" aria-label="ลด">−</button>
        <span>${q}</span>
        <button onclick="setQty('${id}', ${q + 1})" aria-label="เพิ่ม">+</button>
    </div>`;
}

function renderControl(id) {
  const el = document.querySelector(`.ctl[data-id="${id}"]`);
  if (el) {
    el.innerHTML = controlHtml(id);
  }
}

function setQty(id, q) {
  if (window.orderSending || (!ITEMS[id].available && q > 0)) {
    return;
  }
  if (pendingOrder) {
    return toast('กรุณาลองส่งรายการเดิมอีกครั้งก่อนแก้ตะกร้า', true);
  }
  q = Math.max(0, Math.min(20, q));
  if (q === 0) {
    delete cart[id];
  } else {
    cart[id] = q;
  }
  save();
  renderControl(id);
  renderCart();
  if (byId('sheet').classList.contains('open')) {
    renderSheet();
  }
}

function totals() {
  let count = 0,
    extra = 0;
  for (const id of Object.keys(cart)) {
    count += cart[id];
    extra += cart[id] * (ITEMS[id]?.price || 0);
  }
  return { count, extra };
}

function renderCart() {
  const { count, extra } = totals();
  byId('cartCount').textContent = count;
  byId('cartExtra').textContent = extra > 0 ? `+฿${extra}` : '';
  byId('cartBar').classList.toggle('show', count > 0);
  if (count === 0 && byId('sheet').classList.contains('open')) {
    closeSheets();
  }
}

function renderSheet() {
  let html = '';
  for (const id of Object.keys(cart)) {
    const item = ITEMS[id] || { name: 'รายการจากคำขอเดิม', img: '', price: 0 };
    html += `<div class="sheet-line">
            <img src="${item.img}" alt="">
            <div class="nm">${item.name}<small>${item.price ? '฿' + item.price + ' / ชิ้น' : 'รวมในบุฟเฟต์'}</small></div>
            ${controlHtml(id)}
        </div>`;
  }
  byId('sheetBody').innerHTML = html;
  byId('sheetExtra').textContent = '฿' + totals().extra;
}

// ค้นหาและหน้าต่าง
function openSheet(id) {
  if (id === 'sheet') {
    renderSheet();
  }
  dialogOpen(id, 'open');
  byId('sheetOverlay').classList.add('open');
}

function closeSheets() {
  document.querySelectorAll('.sheet.open').forEach((s) => dialogClose(s.id, 'open'));
  byId('sheetOverlay').classList.remove('open');
}

function openCatSheet() {
  const current = document.querySelector('.category-tab.active')?.dataset.cat;
  document.querySelectorAll('.cat-list a').forEach((a) => {
    const on = a.dataset.cat === current;
    a.classList.toggle('current', on);
    a.querySelector('.tick').style.visibility = on ? 'visible' : 'hidden';
  });
  openSheet('catSheet');
}

// Search
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

function filterMenu(q) {
  q = q.trim().toLowerCase();
  let any = false;
  for (const sec of document.querySelectorAll('.menu-section')) {
    let shown = 0;
    for (const row of sec.querySelectorAll('.menu-row')) {
      const hit = !q || row.dataset.name.toLowerCase().includes(q);
      row.style.display = hit ? '' : 'none';
      if (hit) {
        shown++;
      }
    }
    sec.style.display = shown ? '' : 'none';
    if (shown) {
      any = true;
    }
  }
  byId('noResult').style.display = any ? 'none' : 'block';
}
let toastTimer;

function toast(msg, isError) {
  const t = byId('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ส่งออเดอร์
async function submitOrder() {
  if (window.orderSending) {
    return;
  }
  let items = [];
  if (pendingOrder) {
    items = pendingOrder.items;
  } else {
    for (const id of Object.keys(cart)) {
      items.push({ menu_item_id: id, quantity: cart[id] });
    }
  }
  if (items.length === 0) {
    return;
  }
  const btn = byId('sendBtn');
  window.orderSending = true;
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง…';
  try {
    // สร้างคำขอครั้งแรกเท่านั้น การลองส่งซ้ำใช้คำขอเดิม
    if (!pendingOrder) {
      const numbers = new Uint32Array(4);
      crypto.getRandomValues(numbers);
      savePending({ items, key: numbers.join('-').padStart(16, '0') });
    }
    const data = await postData('/orders', { token: TOKEN, items, request_key: pendingOrder.key });
    if (data.success) {
      cart = {};
      savePending(null);
      save();
      window.location.href = `/orders?token=${TOKEN}&sent=1`;
      return;
    }
    if (data.httpStatus < 500) {
      savePending(null);
    }
    toast(data.message || 'ส่งออเดอร์ไม่สำเร็จ', true);
  } catch {
    toast('ยังไม่ได้รับคำตอบ กดลองส่งรายการเดิมอีกครั้งได้', true);
  } finally {
    window.orderSending = false;
    btn.disabled = false;
    btn.textContent = pendingOrder ? 'ลองส่งรายการเดิมอีกครั้ง' : 'ส่งออเดอร์เข้าครัว';
  }
}
// อัปเดตสต็อก
let stockTimer,
  stockLoading = false,
  stockAgain = false,
  stockDelay = 2000;

function scheduleStock(delay = 350) {
  clearTimeout(stockTimer);
  stockTimer = setTimeout(refreshStock, delay);
}

async function refreshStock() {
  if (stockLoading) {
    stockAgain = true;
    return;
  }
  stockLoading = true;
  clearTimeout(stockTimer);
  try {
    const res = await requestFetch('/menu/data?token=' + TOKEN);
    if (res.status === 400) {
      return diningEnded();
    }
    if (!res.ok) {
      throw new Error();
    }
    const data = await res.json();
    for (const item of data.menuItems) {
      const id = item.menu_item_id;
      if (!ITEMS[id]) {
        continue;
      }
      ITEMS[id].available = item.availability === 1;
      const row = document.querySelector('.menu-row[data-id="' + id + '"]');
      row?.classList.toggle('sold-out', !item.availability);
      const tag = row?.querySelector('.sold-tag');
      if (tag) {
        tag.hidden = !!item.availability;
      }
      renderControl(id);
    }
    stockDelay = 2000;
    if (byId('sheet').classList.contains('open')) {
      renderSheet();
    }
  } catch {
    toast('อัปเดตสต็อกไม่ได้ กำลังลองเชื่อมต่อใหม่', true);
    scheduleStock(stockDelay);
    stockDelay = Math.min(stockDelay * 2, 10000);
  } finally {
    stockLoading = false;
    if (stockAgain) {
      stockAgain = false;
      scheduleStock();
    }
  }
}
// หมวดอาหารและเหตุการณ์
const tabs = document.querySelectorAll('.category-tab');
const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || document.body.classList.contains('searching')) {
        continue;
      }
      for (const t of tabs) {
        const on = t.dataset.cat === e.target.dataset.cat;
        t.classList.toggle('active', on);
        if (!on) {
          continue;
        }
        const strip = t.parentElement;
        strip.scrollTo({
          left: t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2,
          behavior: 'smooth'
        });
      }
    }
  },
  { rootMargin: '-60px 0px -75% 0px' }
);
document.querySelectorAll('.menu-section').forEach((s) => observer.observe(s));
document.querySelectorAll('.ctl').forEach((el) => renderControl(el.dataset.id));
renderCart();
if (pendingOrder) {
  byId('sendBtn').textContent = 'ลองส่งรายการเดิมอีกครั้ง';
}
const socket = io({ auth: { token: TOKEN } });
socket.on('stock-updated', () => scheduleStock());
socket.on('connect', refreshStock);
socket.on('connect_error', refreshStock);
socket.on('new-order', () => toast('มีออเดอร์ใหม่ของโต๊ะ ดูได้ในหน้าออเดอร์'));
socket.on('session-closed', diningEnded);
