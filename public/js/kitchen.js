// สลับแท็บออเดอร์กับสต็อก และจำแท็บไว้ใน URL
function showTab(id) {
  byId('ordersTab').hidden = id !== 'ordersTab';
  byId('stockTab').hidden = id !== 'stockTab';
  location.hash = id === 'stockTab' ? 'stock' : '';
  byId('btnOrdersTab').classList.toggle('active', id === 'ordersTab');
  byId('btnStockTab').classList.toggle('active', id === 'stockTab');
}

function restoreTab() {
  showTab(location.hash === '#stock' ? 'stockTab' : 'ordersTab');
}
// อัปเดตข้อมูลครัวและคืนแท็บที่ผู้ใช้เลือกไว้
const refreshLive = liveRegion(['#ordersTab', '#stockTab', '.stat-strip', '.tabs'], restoreTab);
restoreTab();

// ส่งคำสั่งเริ่มทำหรือทำเสร็จให้ทั้งรอบอาหาร
function updateRoundStatus(orderId, status) {
  sendStaffAction('/kitchen/update-status', { order_id: orderId, status }, refreshLive);
}

// ยกเลิกอาหารหนึ่งรายการ หรือยกเลิกพร้อมแจ้งของหมด
function cancelItem(itemId, stock = false) {
  const message = stock ? 'ยกเลิกเพราะวัตถุดิบหมด?' : 'ยกเลิกรายการนี้?';
  if (!confirm(message)) return;
  const body = {
    order_item_id: itemId,
    status: 'CANCELLED',
    out_of_stock: stock
  };
  body.cancel_reason = stock ? 'วัตถุดิบหมด' : 'ยกเลิกรายการ';
  sendStaffAction('/kitchen/update-status', body, refreshLive);
}

// เปิดหรือปิดสต็อกของเมนู แล้วโหลดข้อมูลใหม่
function toggleStock(menuId, availability) {
  sendStaffAction('/kitchen/toggle-stock', { menu_item_id: menuId, availability }, refreshLive);
}
