// ครัวและสต็อก
const socket = io({ auth: { role: 'KITCHEN' } });
const refreshLive = liveRegion(
  socket,
  ['#ordersTab', '#stockTab', '.stat-strip', '.tabs'],
  ['new-order', 'order-status-changed', 'stock-updated', 'session-closed'],
  () => {
    if (location.hash === '#stock') {
      showTab('stockTab');
    }
  }
);

function showTab(tabId) {
  byId('ordersTab').style.display = tabId === 'ordersTab' ? 'block' : 'none';
  byId('stockTab').style.display = tabId === 'stockTab' ? 'block' : 'none';
  byId('btnOrdersTab').classList.toggle('active', tabId === 'ordersTab');
  byId('btnStockTab').classList.toggle('active', tabId === 'stockTab');
  location.hash = tabId === 'stockTab' ? 'stock' : '';
}
// Stay on the stock tab after a toggle reloads the page
if (location.hash === '#stock') {
  showTab('stockTab');
}

function updateRoundStatus(order_id, status) {
  return sendStaffAction('/kitchen/update-status', { order_id, status }, refreshLive);
}

function updateStatus(order_item_id, status) {
  return sendStaffAction('/kitchen/update-status', { order_item_id, status }, refreshLive);
}

function cancelGeneral(id) {
  if (confirm('ยกเลิกรายการนี้หรือไม่?')) {
    updateStatus(id, 'CANCELLED');
  }
}

function cancelItem(order_item_id) {
  if (!confirm('ยืนยันแจ้งวัตถุดิบหมดและยกเลิกรายการนี้หรือไม่?')) {
    return;
  }
  return sendStaffAction(
    '/kitchen/update-status',
    { order_item_id, status: 'CANCELLED', cancel_reason: 'วัตถุดิบหมด', out_of_stock: true },
    refreshLive
  );
}

function toggleStock(menu_item_id, availability) {
  return sendStaffAction(
    '/kitchen/toggle-stock',
    { menu_item_id, availability: Number(availability) },
    refreshLive
  );
}
