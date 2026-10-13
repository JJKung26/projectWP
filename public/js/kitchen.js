// ควบคุมหน้าครัวและปุ่มปรับสถานะของหมด
// ครัวและสต็อก
function restoreStockTab() {
  if (location.hash === '#stock') showTab('stockTab');
}
const refreshLive = liveRegion(
  ['#ordersTab', '#stockTab', '.stat-strip', '.tabs'],
  restoreStockTab
);

// สลับหน้ารายการอาหารกับหน้าสต็อก
function showTab(tabId) {
  byId('ordersTab').style.display = tabId === 'ordersTab' ? 'block' : 'none';
  byId('stockTab').style.display = tabId === 'stockTab' ? 'block' : 'none';
  byId('btnOrdersTab').classList.toggle('active', tabId === 'ordersTab');
  byId('btnStockTab').classList.toggle('active', tabId === 'stockTab');
  location.hash = tabId === 'stockTab' ? 'stock' : '';
}
if (location.hash === '#stock') showTab('stockTab');

// ส่งคำสั่งเปลี่ยนสถานะอาหารทั้งรอบ
function updateRoundStatus(order_id, status) {
  return sendStaffAction('/kitchen/update-status', { order_id, status }, refreshLive);
}

// ส่งคำสั่งเปลี่ยนสถานะอาหารหนึ่งรายการ
function updateStatus(order_item_id, status) {
  return sendStaffAction('/kitchen/update-status', { order_item_id, status }, refreshLive);
}

// ยืนยันยกเลิกอาหารโดยไม่เปลี่ยนสถานะของหมด
function cancelGeneral(id) {
  if (confirm('ยกเลิกรายการนี้หรือไม่?')) updateStatus(id, 'CANCELLED');
}

// ยกเลิกอาหารและแจ้งเมนูนี้ว่าของหมด
function cancelItem(order_item_id) {
  if (!confirm('ยืนยันแจ้งวัตถุดิบหมดและยกเลิกรายการนี้หรือไม่?')) return;
  return sendStaffAction(
    '/kitchen/update-status',
    { order_item_id, status: 'CANCELLED', cancel_reason: 'วัตถุดิบหมด', out_of_stock: true },
    refreshLive
  );
}

// ส่งสถานะมีของหรือของหมดของเมนูที่เลือก
function toggleStock(menu_item_id, availability) {
  return sendStaffAction(
    '/kitchen/toggle-stock',
    { menu_item_id, availability: Number(availability) },
    refreshLive
  );
}
