// รวมจำนวนผู้ใหญ่กับเด็ก และตั้งจำนวนเริ่มต้นของฟอร์มเปิดโต๊ะหรือจัดคิว
function updateGuestTotal(prefix) {
  const adults = Number(byId(prefix + 'AdultCount').value);
  const children = Number(byId(prefix + 'ChildCount').value);
  const freeChildren = Number(byId(prefix + 'FreeChildCount').value);
  byId(prefix + 'GuestTotal').textContent = adults + children + freeChildren;
}

function resetGuestCounts(prefix, adults) {
  byId(prefix + 'AdultCount').value = adults;
  byId(prefix + 'ChildCount').value = 0;
  byId(prefix + 'FreeChildCount').value = 0;
  byId(prefix + 'AdultPrice').value = 279;
  byId(prefix + 'ChildPrice').value = 179;
  updateGuestTotal(prefix);
}

// ปุ่มบวกและลบจำนวน โดยใช้ค่าต่ำสุดกับสูงสุดของช่องกรอก
function stepInput(id, delta) {
  const input = byId(id);
  const value = Number(input.value) + delta;
  input.value = Math.max(Number(input.min), Math.min(Number(input.max), value));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// เวลาในช่องโต๊ะใช้ ชั่วโมง:นาที เพื่อไม่ให้ข้อความตัดบรรทัด
function renderElapsed() {
  const labels = document.querySelectorAll('.elapsed');
  for (const label of labels) {
    const start = new Date(label.dataset.started.replace(' ', 'T') + 'Z');
    const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
    const hours = Math.floor(minutes / 60);
    const remainder = String(minutes % 60).padStart(2, '0');
    label.textContent = hours + ':' + remainder;
  }
}

// เปิดป๊อปอัปทีละอัน และรีเฟรชโต๊ะหลังปิด
function openModal(id) {
  for (const dialog of document.querySelectorAll('.modal-overlay.active')) {
    dialogClose(dialog.id);
  }
  dialogOpen(id);
}

function closeModal(id) {
  dialogClose(id);
  setTimeout(refreshTables, 350);
}

// จำโต๊ะที่กด แล้วเลือกแสดงฟอร์มเปิดโต๊ะหรือเมนูโต๊ะมีลูกค้า
let selectedTable;
function handleTableClick(tableId, tableNo, status, sessionId, qrToken) {
  selectedTable = { tableId, tableNo, qrToken };
  if (status === 'AVAILABLE') {
    byId('openTableId').value = tableId;
    byId('openTableNo').textContent = tableNo;
    resetGuestCounts('open', 0);
    openModal('openTableModal');
  } else {
    byId('occTableNo').textContent = tableNo;
    byId('checkBillBtn').href = '/cashier/bill/' + sessionId;
    openModal('occupiedTableModal');
  }
}

// ใช้ action ของฟอร์ม จึงไม่ต้องเลือก URL ซ้ำใน JavaScript
async function submitTable(event) {
  event.preventDefault();
  const form = event.target;
  const data = await requestAction(form.action, readForm(form), event.submitter);
  if (data) {
    closeModal(form.closest('dialog').id);
    displaySlipData(data);
    openModal('slipModal');
  }
}

// ขอยกเลิกโต๊ะที่เปิดผิดและยังไม่มีอาหาร
async function resetTableStatus() {
  if (!confirm('ยกเลิกโต๊ะ ' + selectedTable.tableNo + ' ที่ยังไม่มีอาหาร?')) return;
  const data = await requestAction('/cashier/reset-table', {
    table_id: selectedTable.tableId
  });
  if (data) closeModal('occupiedTableModal');
}

// แสดงใบ QR จากเซิร์ฟเวอร์ และจำลิงก์ไว้คัดลอกหรือพิมพ์
let currentCustomerUrl = '';
function displaySlipData(data) {
  byId('slipPrintArea').innerHTML = data.slip_html;
  currentCustomerUrl = data.customer_url;
}

async function showReceiptSlipModal() {
  const data = await requestAction('/cashier/qr/' + selectedTable.qrToken);
  if (data) {
    displaySlipData(data);
    openModal('slipModal');
  }
}

function printSlip() {
  const id = byId('slipModal').open ? 'slipPrintArea' : 'queueSlipPrintArea';
  printDocument(id);
}

// คัดลอกลิงก์ลูกค้า ถ้าคัดลอกไม่ได้ให้แสดงช่องคัดลอกเอง
async function copySlipUrl() {
  try {
    await navigator.clipboard.writeText(currentCustomerUrl);
    alert('คัดลอกลิงก์แล้ว');
  } catch {
    prompt('คัดลอกลิงก์:', currentCustomerUrl);
  }
}

// อัปเดตเวลาบนโต๊ะและปุ่มจัดโต๊ะ หลังโหลดข้อมูลใหม่
function afterTableRefresh() {
  renderElapsed();
  const button = document.querySelector('#seatQueueModal button[type=submit]');
  const selected = document.querySelector('#seatTableSelect input:checked');
  button.disabled = !selected;
}
// รีเฟรชเฉพาะผังโต๊ะและยอดรวม พร้อมอัปเดตเวลาเป็นระยะ
const refreshTables = liveRegion(
  ['.grid-50-tables', '.stat-strip', '#seatTableSelect', '#tableAlert'],
  afterTableRefresh
);
renderElapsed();
setInterval(renderElapsed, 30000);
