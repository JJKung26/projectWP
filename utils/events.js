// ส่งข้อมูลเฉพาะบทบาทที่เกี่ยวข้อง และลูกค้าในรอบบริการนั้น
module.exports = function emit(req, event, data = {}) {
    const io = req.app.get('socketio');
    if (!io) return;
    const rooms = ['staff:ADMIN'];
    if (event.startsWith('queue-') || event === 'table-status-changed') rooms.push('staff:CASHIER');
    else if (event === 'stock-updated') rooms.push('staff:KITCHEN', 'customers');
    else rooms.push('staff:CASHIER', 'staff:KITCHEN', 'staff:SERVICE');
    if (data.session_id && event !== 'table-status-changed')
        rooms.push('session:' + data.session_id);
    io.to(rooms).emit(event, data);
    if (event === 'session-closed') io.in('session:' + data.session_id).disconnectSockets(true);
};
