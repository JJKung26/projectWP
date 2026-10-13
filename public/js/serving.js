// อัปเดตรายการพร้อมเสิร์ฟและส่งคำสั่งยืนยันเสิร์ฟ
// จุดเสิร์ฟ
const refreshLive = liveRegion(['.container']);

// ส่งรหัสออเดอร์เพื่อยืนยันว่าเสิร์ฟทั้งรอบแล้ว
function confirmServedRound(order_id) {
  return sendStaffAction('/serving/confirm-served', { order_id }, refreshLive);
}
