let currentCustomerUrl = '';
async function showReceiptSlipModal() {
    closeModal('occupiedTableModal');
    try {
        const res = await requestFetch(`/cashier/qr/${selectedTable.qrToken}`);
        const data = await res.json();
        if (data.success) {
            displaySlipData(data);
            openModal('slipModal');
        } else {
            alert(data.message || 'ไม่สามารถโหลดข้อมูลโต๊ะได้');
        }
    } catch (err) {
        alert('ไม่สามารถโหลดข้อมูลใบเปิดโต๊ะได้');
    }
}

// Populate Slip Modal fields
function displaySlipData(data) {
    document.getElementById('slipTableNo').innerText = data.table_no;
    const start = new Date(data.started_at.replace(' ', 'T') + 'Z');
    const end = new Date(start.getTime() + 120 * 60000);
    const date = value => value.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
    const time = value =>
        value.toLocaleTimeString('th-TH', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        });
    document.getElementById('slipStartedAt').innerText = date(start);
    document.getElementById('slipStartTime').innerText = time(start);
    document.getElementById('slipEndTime').innerText = time(end);
    document.getElementById('slipEndDate').innerText =
        date(start) === date(end) ? '' : 'หมดเวลาในวันที่ ' + date(end);
    document.getElementById('slipSessionId').innerText = data.session_id.slice(0, 8).toUpperCase();
    document.getElementById('slipGuestCount').innerText = data.guest_count;
    document.getElementById('slipBuffetPrice').innerText = data.buffet_price;
    document.getElementById('slipAdultCount').innerText =
        data.guest_count - (data.child_count || 0) - (data.free_child_count || 0);
    document.getElementById('slipChildCount').innerText = data.child_count || 0;
    document.getElementById('slipChildPrice').innerText = data.child_price ?? 179;
    document.getElementById('slipFreeChildCount').innerText = data.free_child_count || 0;
    document.getElementById('slipChildRow').hidden = !data.child_count;
    document.getElementById('slipFreeChildRow').hidden = !data.free_child_count;
    const amount = value =>
        Number(value).toLocaleString('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    document.getElementById('slipEstTotal').innerText = amount(data.buffet_totals.subtotal);
    document.getElementById('slipVat').innerText = amount(data.buffet_totals.taxAmount);
    document.getElementById('slipRounding').innerText = amount(data.buffet_totals.roundingAmount);
    document.getElementById('slipGrandTotal').innerText = amount(data.buffet_totals.netAmount);
    document.getElementById('slipQrImg').src = data.qr_image;
    document.getElementById('slipUrlText').innerText = data.customer_url;
    currentCustomerUrl = data.customer_url;
}

// Print Receipt Slip
function printSlip() {
    printDocument(
        document.getElementById('slipModal').classList.contains('active')
            ? 'slipPrintArea'
            : 'queueSlipPrintArea'
    );
}

// Copy URL to clipboard
function copySlipUrl() {
    if (!currentCustomerUrl) return;
    if (!navigator.clipboard) return prompt('คัดลอกลิงก์:', currentCustomerUrl);
    navigator.clipboard
        .writeText(currentCustomerUrl)
        .then(() => {
            alert('คัดลอกลิงก์เรียบร้อยแล้ว: ' + currentCustomerUrl);
        })
        .catch(() => {
            prompt('คัดลอกลิงก์:', currentCustomerUrl);
        });
}
