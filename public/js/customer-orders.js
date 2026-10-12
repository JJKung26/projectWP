// สถานะออเดอร์
if (new URLSearchParams(location.search).get('sent')) {
  const t = byId('toast');
  t.textContent = 'ส่งออเดอร์เข้าครัวเรียบร้อยแล้ว';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
  history.replaceState(null, '', location.pathname + '?token=' + TOKEN);
}

function toggleCustDropdown(orderId) {
  toggleOrderDropdown(orderId, true);
}
const socket = io({ auth: { token: TOKEN } });
liveRegion(socket, ['main'], ['new-order', 'order-status-changed']);
socket.on('session-closed', diningEnded);
socket.on('connect_error', async () => {
  try {
    const response = await requestFetch('/menu/data?token=' + TOKEN);
    if (response.status === 400) {
      diningEnded();
    }
  } catch {}
});
