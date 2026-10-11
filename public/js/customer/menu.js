// Highlight the tab of the section being read
const tabs = [...document.querySelectorAll('.category-tab')];
const observer = new IntersectionObserver(
    entries => {
        entries.forEach(e => {
            if (!e.isIntersecting || document.body.classList.contains('searching')) return;
            tabs.forEach(t => {
                const on = t.dataset.cat === e.target.dataset.cat;
                t.classList.toggle('active', on);
                if (on) {
                    const strip = t.parentElement;
                    strip.scrollTo({
                        left: t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2,
                        behavior: 'smooth'
                    });
                }
            });
        });
    },
    { rootMargin: '-60px 0px -75% 0px' }
);
document.querySelectorAll('.menu-section').forEach(s => observer.observe(s));

document.querySelectorAll('.ctl').forEach(el => renderControl(el.dataset.id));
renderCart();
if (pendingOrder) document.getElementById('sendBtn').textContent = 'ลองส่งรายการเดิมอีกครั้ง';

const socket = io({ auth: { token: TOKEN } });
socket.on('stock-updated', () => {
    clearTimeout(stockTimer);
    stockTimer = setTimeout(refreshStock, 350);
});
socket.on('connect', refreshStock);
socket.on('connect_error', refreshStock);
socket.on('new-order', () => toast('มีออเดอร์ใหม่ของโต๊ะ ดูได้ในหน้าออเดอร์'));
socket.on('session-closed', diningEnded);
