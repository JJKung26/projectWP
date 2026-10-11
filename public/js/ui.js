// หยุดรอเมื่อเครือข่ายค้าง เพื่อให้ finally ปลดล็อกปุ่มได้
async function requestFetch(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
    if (response.redirected && new URL(response.url).pathname === '/login') {
        throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    return response;
}

const dialogFocus = new Map();
async function sendStaffAction(url, body, refresh) {
    if (window.staffSending) return;
    window.staffSending = true;
    const controls = [...document.querySelectorAll('.container button')].map(el => [el,el.disabled]);
    controls.forEach(([el]) => el.disabled = true);
    try {
        const response = await requestFetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        refresh();
    } catch (err) { alert(['TimeoutError','TypeError'].includes(err.name) ? 'ยังไม่ได้รับคำตอบ กรุณาดูสถานะล่าสุดก่อนลองอีกครั้ง' : err.message); refresh(); }
    finally {
        window.staffSending = false;
        controls.forEach(([el,disabled]) => el.disabled = disabled);
    }
}
function dialogOpen(id, state = 'active') {
    const dialog = document.getElementById(id);
    dialogFocus.set(id, document.activeElement);
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-hidden', 'false');
    const title = dialog.querySelector('h2,h3');
    if (title) { title.id ||= id + 'Title'; dialog.setAttribute('aria-labelledby', title.id); }
    dialog.classList.add(state);
    dialog.tabIndex = -1;
    (dialog.querySelector('[data-dialog-focus]') || dialog.querySelector('input:not([type=hidden]):not(:disabled),select:not(:disabled),button:not(:disabled),a[href]') || dialog).focus();
}
function dialogClose(id, state = 'active') {
    const dialog = document.getElementById(id);
    const previous = dialogFocus.get(id);
    if (previous?.isConnected) previous.focus();
    dialog.classList.remove(state);
    dialog.setAttribute('aria-hidden', 'true');
    dialogFocus.delete(id);
}
function closeActiveDialog(dialog) {
    if (window.orderSending || window.printingDocument || dialog.querySelector('button[type=submit]:disabled')) return;
    if (dialog.classList.contains('sheet')) closeSheets();
    else closeModal(dialog.id);
}
document.addEventListener('keydown', event => {
    const dialog = document.querySelector('.modal-overlay.active,.sheet.open');
    if (!dialog) return;
    if (event.key === 'Escape') { event.preventDefault(); closeActiveDialog(dialog); }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button,input,select,a[href],[tabindex="0"]')]
        .filter(el => !el.disabled && el.offsetParent !== null);
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
document.addEventListener('click', event => {
    if (event.target.matches('.modal-overlay.active')) closeActiveDialog(event.target);
});
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-overlay,.sheet').forEach(el => el.setAttribute('aria-hidden','true'));
});
