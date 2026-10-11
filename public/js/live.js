// รวม event ที่มาติดกัน แล้วดึงเฉพาะส่วนข้อมูล ฟอร์มและตะกร้าจึงคงเดิม
function liveRegion(socket, selectors, events, afterRefresh) {
    let timer,
        loading = false,
        pending = false,
        retryDelay = 350;
    const busy = () =>
        window.printingDocument ||
        window.orderSending ||
        window.staffSending ||
        document.querySelector('.modal-overlay.active,.sheet.open') ||
        selectors.some(selector => {
            const current = document.querySelector(selector);
            return (
                current?.contains(document.activeElement) &&
                document.activeElement.matches('input,select,textarea')
            );
        });
    async function refresh() {
        timer = null;
        if (document.getElementById('diningEnded')) {
            pending = false;
            return;
        }
        if (loading || busy()) {
            pending = true;
            return;
        }
        loading = true;
        pending = false;
        try {
            const response = await requestFetch(location.pathname + location.search, {
                headers: { Accept: 'text/html' }
            });
            if (response.status === 400 && socket.auth?.token) return diningEnded();
            if (!response.ok || response.redirected)
                throw new Error('กรุณาตรวจการเชื่อมต่อหรือเข้าสู่ระบบอีกครั้ง');
            const next = new DOMParser().parseFromString(await response.text(), 'text/html');
            if (busy()) {
                pending = true;
                return;
            }
            const focusedId = document.activeElement.id;
            const collapsed = [...document.querySelectorAll('.collapsed[id]')].map(el => el.id);
            const expanded = [
                ...document.querySelectorAll('.round-card-dropdown[id],.cust-round-dropdown[id]')
            ].map(el => [el.id, el.classList.contains('open')]);
            selectors.forEach(selector => {
                const current = document.querySelector(selector),
                    replacement = next.querySelector(selector);
                if (current && replacement) current.innerHTML = replacement.innerHTML;
            });
            collapsed.forEach(id => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.classList.add('collapsed');
                const orderId = id.replace(/^(toggle-btn-|cust-btn-)/, '');
                document.getElementById('dropdown-' + orderId)?.classList.remove('open');
                document.getElementById('cust-dropdown-' + orderId)?.classList.remove('open');
                const label = btn.querySelector('.toggle-text');
                if (label) label.textContent = 'ดูรายการ';
            });
            expanded.forEach(([id, open]) => {
                const dropdown = document.getElementById(id);
                if (!dropdown) return;
                dropdown.classList.toggle('open', open);
                const orderId = id.replace(/^(dropdown-|cust-dropdown-)/, '');
                const btn =
                    document.getElementById('toggle-btn-' + orderId) ||
                    document.getElementById('cust-btn-' + orderId);
                btn?.classList.toggle('collapsed', !open);
                const label = btn?.querySelector('.toggle-text');
                if (label) label.textContent = open ? 'ซ่อนรายการ' : 'ดูรายการ';
            });
            if (focusedId) document.getElementById(focusedId)?.focus();
            if (afterRefresh) afterRefresh();
            retryDelay = 350;
            document.getElementById('liveError')?.remove();
        } catch (err) {
            pending = true;
            retryDelay = Math.min(Math.max(2000, retryDelay * 2), 10000);
            if (!document.getElementById('liveError')) {
                const p = document.createElement('p');
                p.id = 'liveError';
                p.textContent = ['TimeoutError', 'TypeError'].includes(err.name)
                    ? 'อัปเดตข้อมูลไม่ได้ กำลังลองเชื่อมต่อใหม่'
                    : err.message;
                p.setAttribute('role', 'status');
                document.body.appendChild(p);
            }
        } finally {
            loading = false;
            if (pending) schedule();
        }
    }
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(refresh, retryDelay);
    }
    events.forEach(event => socket.on(event, schedule));
    socket.on('connect', () => {
        retryDelay = 350;
        schedule();
    });
    socket.on('connect_error', () => {
        pending = true;
    });
    setInterval(() => {
        if (pending && !loading && !timer) schedule();
    }, 1500);
    return schedule;
}
function diningEnded() {
    if (document.getElementById('diningEnded')) return;
    document.querySelectorAll('button,input').forEach(el => (el.disabled = true));
    const box = document.createElement('div');
    box.id = 'diningEnded';
    box.className = 'card';
    box.style.cssText = 'position:fixed;inset:20% 5% auto;z-index:9999;text-align:center';
    box.textContent = 'รอบบริการนี้จบแล้ว กรุณาติดต่อพนักงาน';
    document.body.appendChild(box);
}
