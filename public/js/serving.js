// อัปเดตรอบอาหารที่พร้อมเสิร์ฟทุก 5 วินาที
const refreshLive = liveRegion(['.container']);
// ส่งคำยืนยันเสิร์ฟทั้งรอบ แล้วโหลดรายการใหม่
function confirmServedRound(order_id) {
  sendStaffAction('/serving/confirm-served', { order_id }, refreshLive);
}
