// แจ้งว่าส่งอาหารแล้ว และอัปเดตสถานะออเดอร์ของลูกค้า
// สถานะออเดอร์
if (new URLSearchParams(location.search).get('sent')) {
  const notice = byId('toast');
  notice.textContent = 'ส่งออเดอร์เข้าครัวเรียบร้อยแล้ว';
  notice.classList.add('show');
  setTimeout(() => notice.classList.remove('show'), 2600);
  history.replaceState(null, '', location.pathname + '?token=' + TOKEN);
}

// เปิดหรือซ่อนอาหารในรอบที่ลูกค้าเลือก
function toggleCustDropdown(orderId) {
  toggleOrderDropdown(orderId, true);
}
liveRegion(['main']);
