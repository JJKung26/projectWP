const socket = io({ auth: { role: 'CASHIER' } });
const refreshTables = liveRegion(
    socket,
    ['.grid-50-tables', '.stat-strip', '#seatTableSelect', '#tableAlert'],
    ['table-status-changed'],
    () => {
        renderElapsed();
        document.querySelector('#seatQueueModal button[type=submit]').disabled =
            !document.querySelector('#seatTableSelect input:checked');
    }
);
renderElapsed();
setInterval(renderElapsed, 30000);

// Socket.IO Listeners
socket.on('connect', loadQueues);
socket.on('queue-updated', () => {
    loadQueues();
});

socket.on('queue-called', data => {
    document.getElementById('queueNotice').textContent = 'เรียกคิว ' + data.queue_no + ' แล้ว';
    announceQueue(data.queue_no);
});
