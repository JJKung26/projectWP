// แสดงข้อความส่งออเดอร์สำเร็จ แล้วลบ sent ออกจาก URL
if (new URLSearchParams(location.search).has('sent')) {
  byId('toast').textContent = 'ส่งออเดอร์เข้าครัวเรียบร้อยแล้ว';
  byId('toast').classList.add('show');
  setTimeout(function () {
    byId('toast').classList.remove('show');
  }, 2600);
  history.replaceState(null, '', '/orders?token=' + TOKEN);
}
// อัปเดตสถานะอาหารในหน้าลูกค้าทุก 5 วินาที
liveRegion(['main']);
