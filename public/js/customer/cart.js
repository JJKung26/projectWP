const STORE_KEY = 'cart:' + TOKEN;

// เก็บคำขอเดิมไว้ เมื่อไม่ได้รับคำตอบให้ลองส่งด้วย key เดิม
let cart = {};
try {
    cart = JSON.parse(sessionStorage.getItem(STORE_KEY)) || {};
} catch (e) {
    cart = {};
}
let pendingOrder = null;
try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY + ':pending'));
    const items = saved && JSON.parse(saved.payload);
    if (
        saved &&
        typeof saved.key === 'string' &&
        Array.isArray(items) &&
        items.length &&
        items.every(
            i =>
                typeof i.menu_item_id === 'string' &&
                Number.isInteger(i.quantity) &&
                i.quantity > 0 &&
                i.quantity <= 20
        )
    ) {
        pendingOrder = saved;
        cart = Object.fromEntries(items.map(i => [i.menu_item_id, i.quantity]));
    }
} catch {}
if (!pendingOrder)
    Object.keys(cart).forEach(id => {
        if (!ITEMS[id] || !ITEMS[id].available) delete cart[id];
    });

function save() {
    try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(cart));
    } catch (e) {}
}

const plusIcon =
    '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>';

function controlHtml(id) {
    if (!ITEMS[id]) return '<span>รายการจากคำขอเดิม</span>';
    if (!ITEMS[id].available)
        return (
            '<span>หมดชั่วคราว</span>' +
            (cart[id] ? `<button onclick="setQty('${id}',0)">เอาออก</button>` : '')
        );
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
    if (el) el.innerHTML = controlHtml(id);
}

function setQty(id, q) {
    if (window.orderSending || (!ITEMS[id].available && q > 0)) return;
    if (pendingOrder) return toast('กรุณาลองส่งรายการเดิมอีกครั้งก่อนแก้ตะกร้า', true);
    q = Math.max(0, Math.min(20, q));
    if (q === 0) delete cart[id];
    else cart[id] = q;
    save();
    renderControl(id);
    renderCart();
    if (document.getElementById('sheet').classList.contains('open')) renderSheet();
}

function totals() {
    let count = 0,
        extra = 0;
    Object.entries(cart).forEach(([id, q]) => {
        count += q;
        extra += q * (ITEMS[id]?.price || 0);
    });
    return { count, extra };
}

function renderCart() {
    const { count, extra } = totals();
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartExtra').textContent = extra > 0 ? `+฿${extra}` : '';
    document.getElementById('cartBar').classList.toggle('show', count > 0);
    if (count === 0 && document.getElementById('sheet').classList.contains('open')) closeSheets();
}

function renderSheet() {
    document.getElementById('sheetBody').innerHTML = Object.entries(cart)
        .map(([id]) => {
            const it = ITEMS[id] || { name: 'รายการจากคำขอเดิม', img: '', price: 0 };
            return `<div class="sheet-line">
            <img src="${it.img}" alt="">
            <div class="nm">${it.name}<small>${it.price ? '฿' + it.price + ' / ชิ้น' : 'รวมในบุฟเฟต์'}</small></div>
            ${controlHtml(id)}
        </div>`;
        })
        .join('');
    document.getElementById('sheetExtra').textContent = '฿' + totals().extra;
}
