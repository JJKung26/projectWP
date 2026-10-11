let qrLoadId = 0,
    qrReady = false,
    paymentSending = false;
const payElement = id => document.getElementById(id);
const selectedPayMethod = () => payElement('payMethod').querySelector('input:checked').value;

function closeModal() {
    dialogClose('paymentModal');
}
function openPayment() {
    payElement('payCash').checked = true;
    togglePayDetails();
    dialogOpen('paymentModal');
}
function updatePaymentButton() {
    payElement('confirmPayment').disabled =
        paymentSending ||
        (selectedPayMethod() === 'PROMPTPAY' &&
            (!qrReady || !payElement('promptpayVerified').checked));
}
function togglePayDetails() {
    ++qrLoadId; // ไม่ใช้ผลโหลดเก่าเมื่อพนักงานเปลี่ยนช่องทาง
    const method = selectedPayMethod();
    payElement('cashDetails').hidden = method !== 'CASH';
    payElement('promptpayDetails').hidden = method !== 'PROMPTPAY';
    payElement('cardNotice').hidden = method !== 'CREDIT_CARD';
    payElement('amountReceived').required = method === 'CASH';
    payElement('amountReceived').value = NET;
    calcChange();
    if (method === 'PROMPTPAY') loadPromptpay();
    updatePaymentButton();
}
function calcChange() {
    payElement('changeAmount').textContent = (
        Math.max(0, Math.round(Number(payElement('amountReceived').value) * 100) - NET * 100) / 100
    ).toFixed(2);
}
async function loadPromptpay() {
    const load = ++qrLoadId;
    qrReady = false;
    payElement('promptpayVerified').checked = false;
    payElement('promptpayVerified').disabled = true;
    payElement('promptpayQr').hidden = true;
    payElement('promptpayRecipient').textContent = '';
    payElement('promptpayStatus').textContent = 'กำลังสร้าง QR ตามยอดบิล…';
    updatePaymentButton();
    try {
        const res = await requestFetch('/cashier/promptpay/' + encodeURIComponent(SESSION_ID), {
            headers: { Accept: 'application/json' }
        });
        const data = await res.json();
        if (load !== qrLoadId) return;
        if (!data.success) throw new Error(data.message);
        if (data.amount !== NET) throw new Error('ยอดบิลเปลี่ยนแล้ว กรุณาโหลดหน้าเช็กบิลใหม่');
        const image = payElement('promptpayQr');
        image.src = data.qr_image;
        await image.decode();
        if (load !== qrLoadId) return;
        image.hidden = false;
        payElement('promptpayRecipient').textContent = 'หมายเลขพร้อมเพย์: ' + data.number;
        payElement('promptpayStatus').textContent = 'แอปธนาคารจะแสดงยอดชำระจาก QR นี้';
        qrReady = true;
        payElement('promptpayVerified').disabled = false;
    } catch (err) {
        if (load !== qrLoadId) return;
        payElement('promptpayStatus').textContent = ['TimeoutError', 'TypeError'].includes(err.name)
            ? 'โหลด QR ไม่สำเร็จ กรุณาลองอีกครั้ง'
            : err.message;
    }
    if (load === qrLoadId) updatePaymentButton();
}
async function submitPayment(e) {
    e.preventDefault();
    if (paymentSending || payElement('confirmPayment').disabled) return;
    const payment_method = selectedPayMethod();
    const promptpay_verified =
        payment_method === 'PROMPTPAY' && qrReady && payElement('promptpayVerified').checked;
    if (payment_method === 'PROMPTPAY' && !promptpay_verified) return;
    paymentSending = true;
    payElement('payMethod').disabled = payElement('reloadPromptpay').disabled = true;
    updatePaymentButton();
    try {
        const amount_received =
            payment_method === 'CASH' ? payElement('amountReceived').value : NET;
        const res = await requestFetch('/cashier/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: SESSION_ID,
                payment_method,
                amount_received,
                expected_total: NET,
                promptpay_verified
            })
        });
        const data = await res.json();
        if (data.success) location.href = data.receipt_url;
        else {
            alert(data.message);
            if (res.status === 409) location.reload();
        }
    } catch {
        alert('เชื่อมต่อไม่ได้ กดอีกครั้งเพื่อรับผลการชำระเดิม');
    } finally {
        paymentSending = false;
        payElement('payMethod').disabled = payElement('reloadPromptpay').disabled = false;
        updatePaymentButton();
    }
}
