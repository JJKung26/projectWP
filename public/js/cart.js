// จำตะกร้าและรหัสส่งออเดอร์ของโต๊ะนี้ไว้ใน sessionStorage
const STORE_KEY = 'cart:' + TOKEN;
let cart = JSON.parse(sessionStorage.getItem(STORE_KEY)) || {};
let orderKey = sessionStorage.getItem(STORE_KEY + ':key') || Date.now() + '-' + Math.random();

function saveCart() {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(cart));
  sessionStorage.setItem(STORE_KEY + ':key', orderKey);
}

// สร้างปุ่มเพิ่ม ลด หรือเอาอาหารที่หมดออกจากตะกร้า
function controlHtml(id) {
  const quantity = cart[id] || 0;
  if (!ITEMS[id].available) {
    let html = 'หมดชั่วคราว';
    if (quantity > 0) {
      html += `<button onclick="setQty('${id}',0)">เอาออก</button>`;
    }
    return html;
  }
  if (quantity === 0)
    return `<button class="add-btn center"
      onclick="setQty('${id}',1)" aria-label="เพิ่มอาหาร">+</button>`;
  return `<div class="qty row">
    <button class="plain-button center"
      onclick="setQty('${id}',${quantity - 1})" aria-label="ลด">−</button>
    <span class="digits">${quantity}</span>
    <button class="plain-button center"
      onclick="setQty('${id}',${quantity + 1})" aria-label="เพิ่ม">+</button>
  </div>`;
}

// ใส่ปุ่มจำนวนลงในการ์ดเมนู และบันทึกเมื่อเปลี่ยนจำนวน
function renderControl(id) {
  const control = document.querySelector('.ctl[data-id="' + id + '"]');
  control.innerHTML = controlHtml(id);
}

function setQty(id, quantity) {
  if (window.orderSending) return;
  quantity = Math.max(0, Math.min(20, quantity));
  if (quantity > 0) cart[id] = quantity;
  else delete cart[id];
  orderKey = Date.now() + '-' + Math.random();
  saveCart();
  renderControl(id);
  renderCart();
}

// แสดงอาหารในตะกร้า จำนวนรวม และค่าอาหารที่คิดเพิ่ม
function renderCart() {
  let count = 0;
  let extra = 0;
  let html = '';
  for (const id in cart) {
    const item = ITEMS[id];
    count += cart[id];
    extra += cart[id] * item.price;
    const priceText = item.price > 0 ? '฿' + item.price + ' / ชิ้น' : 'รวมในบุฟเฟต์';
    html += `<div class="sheet-line row">
      <img src="${item.img}" alt="">
      <div class="nm">${escapeHtml(item.name)}<small>${priceText}</small></div>
      ${controlHtml(id)}</div>`;
  }
  byId('cartCount').textContent = count;
  byId('cartExtra').textContent = extra > 0 ? '+฿' + extra : '';
  byId('cartBar').classList.toggle('show', count > 0);
  byId('sheetBody').innerHTML = html;
  byId('sheetExtra').textContent = '฿' + extra;
  if (count === 0 && byId('sheet').open) closeSheets();
}

// ส่งรายการเข้าครัว แล้วไปหน้าดูสถานะเมื่อสำเร็จ
async function submitOrder() {
  if (window.orderSending || Object.keys(cart).length === 0) return;
  window.orderSending = true;
  byId('sendBtn').textContent = 'กำลังส่ง…';
  const items = [];
  for (const id in cart) {
    items.push({ menu_item_id: id, quantity: cart[id] });
  }
  const body = { items, request_key: orderKey, token: TOKEN };
  const data = await requestAction('/orders', body, byId('sendBtn'));
  if (data) {
    sessionStorage.removeItem(STORE_KEY);
    sessionStorage.removeItem(STORE_KEY + ':key');
    location.assign('/orders?token=' + TOKEN + '&sent=1');
  }
  window.orderSending = false;
  byId('sendBtn').textContent = 'ส่งออเดอร์เข้าครัว';
}
