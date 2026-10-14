// เปิดและปิดป๊อปอัปรับเงิน โดยเริ่มที่เงินสด
function closeModal() {
  dialogClose('paymentModal');
}

function openPayment() {
  byId('payCash').checked = true;
  togglePayDetails();
  dialogOpen('paymentModal');
}

// แสดงช่องเงินสด QR พร้อมเพย์ หรือรูปบัตรตามที่เลือก
function togglePayDetails() {
  const method = byId('payMethod').querySelector('input:checked').value;
  byId('cashDetails').hidden = method !== 'CASH';
  byId('promptpayDetails').hidden = method !== 'PROMPTPAY';
  byId('cardNotice').hidden = method !== 'CREDIT_CARD';
  byId('amountReceived').required = method === 'CASH';
  byId('amountReceived').value = method === 'CASH' ? 0 : NET;
  calcChange();
}

// คำนวณเงินทอนและแสดงทศนิยมสองตำแหน่ง
function calcChange() {
  const received = Math.round(Number(byId('amountReceived').value) * 100);
  const change = Math.max(0, received - NET * 100);
  byId('changeAmount').textContent = (change / 100).toFixed(2);
}

// ส่งยอดรับเงินและวิธีจ่าย แล้วเปิดใบเสร็จเมื่อสำเร็จ
async function submitPayment(event) {
  event.preventDefault();
  const button = byId('confirmPayment');
  if (button.disabled) return;
  const method = byId('payMethod').querySelector('input:checked').value;
  const received = method === 'CASH' ? byId('amountReceived').value : NET;
  const body = {
    session_id: SESSION_ID,
    payment_method: method,
    expected_total: NET,
    amount_received: received
  };
  byId('payMethod').disabled = true;
  const data = await requestAction('/cashier/payment', body, button);
  byId('payMethod').disabled = false;
  if (data) location.assign(data.receipt_url);
}
