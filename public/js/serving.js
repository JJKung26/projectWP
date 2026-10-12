// จุดเสิร์ฟ
const socket = io({ auth: { role: 'SERVICE' } });
const refreshLive = liveRegion(
  socket,
  ['.container'],
  ['new-order', 'order-status-changed', 'stock-updated', 'session-closed'],
  null
);

function confirmServedRound(order_id) {
  return sendStaffAction('/serving/confirm-served', { order_id }, refreshLive);
}
