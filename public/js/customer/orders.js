async function submitOrder() {
    if (window.orderSending) return;

    const items = pendingOrder
        ? JSON.parse(pendingOrder.payload)
        : Object.entries(cart).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
    if (items.length === 0) return;
    const btn = document.getElementById('sendBtn');
    window.orderSending = true;
    btn.disabled = true;
    btn.textContent = 'กำลังส่ง…';
    try {
        const payload = JSON.stringify(items);
        if (!pendingOrder || pendingOrder.payload !== payload) {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            pendingOrder = {
                payload,
                key: Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('')
            };
            try {
                sessionStorage.setItem(STORE_KEY + ':pending', JSON.stringify(pendingOrder));
            } catch (err) {}
        }
        const res = await requestFetch('/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN, items, request_key: pendingOrder.key })
        });
        const data = await res.json();
        if (data.success) {
            cart = {};
            try {
                sessionStorage.removeItem(STORE_KEY + ':pending');
            } catch (err) {}
            pendingOrder = null;
            save();
            window.location.href = `/orders?token=${TOKEN}&sent=1`;
            return;
        }
        if (res.status < 500) {
            pendingOrder = null;
            try {
                sessionStorage.removeItem(STORE_KEY + ':pending');
            } catch (err) {}
        }
        toast(data.message || 'ส่งออเดอร์ไม่สำเร็จ', true);
    } catch (err) {
        toast('ยังไม่ได้รับคำตอบ กดลองส่งรายการเดิมอีกครั้งได้', true);
    } finally {
        window.orderSending = false;
        btn.disabled = false;
        btn.textContent = pendingOrder ? 'ลองส่งรายการเดิมอีกครั้ง' : 'ส่งออเดอร์เข้าครัว';
    }
}
