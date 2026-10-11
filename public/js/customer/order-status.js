if (new URLSearchParams(location.search).get('sent')) {
    const t = document.getElementById('toast');
    t.textContent = 'ส่งออเดอร์เข้าครัวเรียบร้อยแล้ว';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
    history.replaceState(null, '', location.pathname + '?token=' + TOKEN);
}

function toggleCustDropdown(orderId) {
    const dropdown = document.getElementById('cust-dropdown-' + orderId);
    const btn = document.getElementById('cust-btn-' + orderId);
    if (!dropdown || !btn) return;

    const isOpen = dropdown.classList.contains('open');
    if (isOpen) {
        dropdown.classList.remove('open');
        btn.classList.add('collapsed');
    } else {
        dropdown.classList.add('open');
        btn.classList.remove('collapsed');
    }
}

const socket = io({ auth: { token: TOKEN } });
liveRegion(socket, ['main'], ['new-order', 'order-status-changed']);
socket.on('session-closed', diningEnded);
socket.on('connect_error', () => {
    requestFetch('/menu/data?token=' + TOKEN)
        .then(r => {
            if (r.status === 400) diningEnded();
        })
        .catch(() => {});
});
