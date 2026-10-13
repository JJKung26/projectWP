// เลือกวิธีชำระ คำนวณเงินทอน และส่งข้อมูลรับเงิน
// อ่านวิธีชำระเงินที่เลือก
function selectedPayMethod() {
  return byId('payMethod').querySelector('input:checked').value;
}

// ปิดหน้าต่างรับชำระเงิน
function closeModal() {
  dialogClose('paymentModal');
}

// เปิดหน้าต่างรับเงินโดยเลือกเงินสดไว้ก่อน
function openPayment() {
  byId('payCash').checked = true;
  togglePayDetails();
  dialogOpen('paymentModal');
}

// แสดงช่องเงินสด รูปพร้อมเพย์ หรือข้อความบัตรตามที่เลือก
function togglePayDetails() {
  const method = selectedPayMethod();
  byId('cashDetails').hidden = method !== 'CASH';
  byId('promptpayDetails').hidden = method !== 'PROMPTPAY';
  byId('cardNotice').hidden = method !== 'CREDIT_CARD';
  byId('amountReceived').required = method === 'CASH';
  byId('amountReceived').value = NET;
  calcChange();
}

// คำนวณเงินทอนจากเงินรับและยอดสุทธิ
function calcChange() {
  const received = Math.round(Number(byId('amountReceived').value) * 100);
  const change = Math.max(0, received - NET * 100) / 100;
  byId('changeAmount').textContent = change.toFixed(2);
}

// ส่งข้อมูลรับเงิน แล้วเปิดใบเสร็จเมื่อบันทึกสำเร็จ
async function submitPayment(event) {
  event.preventDefault();
  const button = byId('confirmPayment');
  if (button.disabled) return;
  const payment_method = selectedPayMethod();
  byId('payMethod').disabled = true;
  button.disabled = true;
  try {
    let amount_received = NET;
    if (payment_method === 'CASH') amount_received = byId('amountReceived').value;
    const data = await requestData('/cashier/payment', {
      session_id: SESSION_ID,
      payment_method,
      amount_received,
      expected_total: NET
    });
    if (data.success) {
      location.href = data.receipt_url;
      return;
    }
    alert(data.message);
    if (data.httpStatus === 409) location.reload();
  } catch {
    alert('เชื่อมต่อไม่ได้ กดอีกครั้งเพื่อรับผลการชำระเดิม');
  } finally {
    byId('payMethod').disabled = false;
    button.disabled = false;
  }
}
