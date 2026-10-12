let paymentSending = false;
const selectedPayMethod = () => byId('payMethod').querySelector('input:checked').value;

function closeModal() {
  dialogClose('paymentModal');
}

function openPayment() {
  byId('payCash').checked = true;
  togglePayDetails();
  dialogOpen('paymentModal');
}

function togglePayDetails() {
  const method = selectedPayMethod();
  byId('cashDetails').hidden = method !== 'CASH';
  byId('promptpayDetails').hidden = method !== 'PROMPTPAY';
  byId('cardNotice').hidden = method !== 'CREDIT_CARD';
  byId('amountReceived').required = method === 'CASH';
  byId('amountReceived').value = NET;
  calcChange();
  byId('confirmPayment').disabled = paymentSending;
}

function calcChange() {
  const received = Math.round(Number(byId('amountReceived').value) * 100);
  const change = Math.max(0, received - NET * 100) / 100;
  byId('changeAmount').textContent = change.toFixed(2);
}

async function submitPayment(e) {
  e.preventDefault();
  if (paymentSending || byId('confirmPayment').disabled) {
    return;
  }
  const payment_method = selectedPayMethod();
  paymentSending = true;
  byId('payMethod').disabled = true;
  byId('confirmPayment').disabled = true;
  try {
    const amount_received = payment_method === 'CASH' ? byId('amountReceived').value : NET;
    const data = await postData('/cashier/payment', {
      session_id: SESSION_ID,
      payment_method,
      amount_received,
      expected_total: NET
    });
    if (data.success) {
      location.href = data.receipt_url;
    } else {
      alert(data.message);
      if (data.httpStatus === 409) {
        location.reload();
      }
    }
  } catch {
    alert('เชื่อมต่อไม่ได้ กดอีกครั้งเพื่อรับผลการชำระเดิม');
  } finally {
    paymentSending = false;
    byId('payMethod').disabled = false;
    byId('confirmPayment').disabled = false;
  }
}
