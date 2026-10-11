let selectedTable = {};
// Click handler on table card
function handleTableClick(tableId, tableNo, status, sessionId, qrToken) {
    selectedTable = { tableId, tableNo, status, sessionId, qrToken };
    if (status === 'AVAILABLE') {
        document.getElementById('openTableId').value = tableId;
        document.getElementById('openTableNo').innerText = tableNo;
        resetGuestCounts('open', 0);
        document.getElementById('buffetPrice').value = 279;
        openModal('openTableModal');
    } else if (status === 'OCCUPIED') {
        document.getElementById('occTableNo').innerText = tableNo;
        document.getElementById('checkBillBtn').href = `/cashier/bill/${sessionId}`;
        openModal('occupiedTableModal');
    }
}

// Submit open table form
async function submitOpenTable(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn.disabled) return;
    btn.disabled = true;
    const table_id = document.getElementById('openTableId').value;
    const guests = guestCounts('open');
    const buffet_price = document.getElementById('buffetPrice').value;
    const child_price = document.getElementById('openChildPrice').value;

    try {
        const res = await requestFetch('/cashier/open-table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_id, ...guests, buffet_price, child_price })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('openTableModal');
            // Populate slip details immediately
            displaySlipData(data);
            openModal('slipModal');
        } else {
            alert(data.message || 'เกิดข้อผิดพลาดในการเปิดโต๊ะ');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
        btn.disabled = false;
    }
}

// Show slip modal for occupied table
// Reset Table Status
async function resetTableStatus() {
    const table = { ...selectedTable };
    const message = 'ยกเลิกรอบบริการที่ยังไม่มีอาหาร';
    if (!confirm('โต๊ะ ' + table.tableNo + ': ' + message + ' และเปลี่ยนเป็นว่าง?')) return;
    try {
        const res = await requestFetch('/cashier/reset-table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table_id: table.tableId,
                expected_status: table.status,
                expected_session_id: table.sessionId
            })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('occupiedTableModal');
            refreshTables();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการรีเซ็ตโต๊ะ');
    }
}
