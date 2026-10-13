// ควบคุมโต๊ะ คิว และใบ QR บนหน้าแคชเชียร์
// จำนวนลูกค้าและหน้าต่าง
function updateGuestTotal(prefix) {
  let total = 0;
  for (const type of ['Adult', 'Child', 'FreeChild']) {
    total += Number(byId(prefix + type + 'Count').value);
  }
  byId(prefix + 'GuestTotal').textContent = total;
}

// ตั้งจำนวนผู้ใหญ่ เด็ก และราคาเด็กเริ่มต้น
function resetGuestCounts(prefix, adults) {
  byId(prefix + 'AdultCount').value = adults;
  byId(prefix + 'ChildCount').value = 0;
  byId(prefix + 'FreeChildCount').value = 0;
  byId(prefix + 'ChildPrice').value = 179;
  updateGuestTotal(prefix);
}

// เพิ่มหรือลดตัวเลขในช่องกรอกตามค่าที่อนุญาต
function stepInput(id, delta) {
  const input = byId(id);
  const next = (parseInt(input.value, 10) || 0) + delta;
  input.value = Math.min(Number(input.max || 99), Math.max(Number(input.min || 0), next));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// คำนวณและแสดงเวลาที่ลูกค้าใช้โต๊ะ
function renderElapsed() {
  for (const element of document.querySelectorAll('.elapsed')) {
    const started = new Date(element.dataset.started.replace(' ', 'T') + 'Z');
    const mins = Math.max(0, Math.floor((Date.now() - started) / 60000));
    if (mins < 60) {
      element.textContent = `${mins} นาที`;
    } else if (mins < 1440) {
      element.textContent = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} ชม.`;
    } else {
      element.textContent = `${Math.floor(mins / 1440)} วัน`;
    }
  }
}

// ปิดหน้าต่างเดิม แล้วเปิดหน้าต่างที่เลือก
function openModal(id) {
  for (const dialog of document.querySelectorAll('.modal-overlay.active')) dialogClose(dialog.id);
  dialogOpen(id);
}

// ปิดหน้าต่าง แล้วอัปเดตข้อมูลโต๊ะเมื่อจำเป็น
function closeModal(id) {
  dialogClose(id);
  if (['slipModal', 'queueSlipModal', 'openTableModal', 'seatQueueModal'].includes(id)) {
    refreshTables();
  }
}
// เปิดและจัดการโต๊ะ
let selectedTable = {};

// เลือกโต๊ะแล้วเปิดฟอร์มหรือเมนูจัดการตามสถานะ
function handleTableClick(tableId, tableNo, status, sessionId, qrToken) {
  selectedTable = { tableId, tableNo, status, sessionId, qrToken };
  if (status === 'AVAILABLE') {
    byId('openTableId').value = tableId;
    byId('openTableNo').innerText = tableNo;
    resetGuestCounts('open', 0);
    byId('buffetPrice').value = 279;
    openModal('openTableModal');
  } else if (status === 'OCCUPIED') {
    byId('occTableNo').innerText = tableNo;
    byId('checkBillBtn').href = `/cashier/bill/${sessionId}`;
    openModal('occupiedTableModal');
  }
}

// เปิดโต๊ะโดยตรง หรือจัดลูกค้าจากคิวเข้าโต๊ะ
async function submitTable(event, prefix) {
  event.preventDefault();
  const fromQueue = prefix === 'seat';
  const body = Object.fromEntries(new FormData(event.target));
  if (fromQueue && !body.table_id) return alert('กรุณาเลือกโต๊ะว่าง');
  const data = await requestAction(
    fromQueue ? '/cashier/queue/seat' : '/cashier/open-table',
    body,
    event.submitter
  );
  if (data) {
    closeModal(fromQueue ? 'seatQueueModal' : 'openTableModal');
    displaySlipData(data);
    openModal('slipModal');
  }
}

// ส่งคำขอคืนโต๊ะเป็นว่างหลังยืนยัน
async function resetTableStatus() {
  const table = selectedTable;
  if (!confirm('โต๊ะ ' + table.tableNo + ': ยกเลิกรอบบริการที่ยังไม่มีอาหาร และเปลี่ยนเป็นว่าง?')) {
    return;
  }
  const data = await requestAction('/cashier/reset-table', {
    table_id: table.tableId,
    expected_status: table.status,
    expected_session_id: table.sessionId
  });
  if (data) {
    closeModal('occupiedTableModal');
    refreshTables();
  }
}
// ใบเปิดโต๊ะ
let currentCustomerUrl = '';

// อ่านและแสดงใบ QR ของโต๊ะที่เลือก
async function showReceiptSlipModal() {
  closeModal('occupiedTableModal');
  const data = await requestAction(`/cashier/qr/${selectedTable.qrToken}`);
  if (data) {
    displaySlipData(data);
    openModal('slipModal');
  }
}

// ใส่เนื้อหาใบเปิดโต๊ะและเก็บลิงก์ลูกค้า
function displaySlipData(data) {
  byId('slipPrintArea').innerHTML = data.slip_html;
  currentCustomerUrl = data.customer_url;
}

// เลือกใบ QR หรือบัตรคิวที่กำลังเปิดอยู่เพื่อพิมพ์
function printSlip() {
  printDocument(
    byId('slipModal').classList.contains('active') ? 'slipPrintArea' : 'queueSlipPrintArea'
  );
}

// คัดลอกลิงก์สั่งอาหารให้ลูกค้า
async function copySlipUrl() {
  if (!currentCustomerUrl) return;
  if (!navigator.clipboard) return prompt('คัดลอกลิงก์:', currentCustomerUrl);
  try {
    await navigator.clipboard.writeText(currentCustomerUrl);
    alert('คัดลอกลิงก์เรียบร้อยแล้ว: ' + currentCustomerUrl);
  } catch {
    prompt('คัดลอกลิงก์:', currentCustomerUrl);
  }
}
// จัดการคิว
let lastTicketId = readStorage('lastQueueTicket') || '';

// ใส่เลขคิว เวลา และจำนวนลูกค้าลงบนบัตร
function displayQueueTicket(ticket) {
  lastTicketId = ticket.queue_ticket_id;
  writeStorage('lastQueueTicket', lastTicketId);
  byId('qsQueueNo').innerText = ticket.queue_no;
  byId('qsDate').innerText = ticket.queue_date;
  byId('qsTime').innerText = ticket.created_at
    ? new Date(ticket.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok'
      })
    : 'ไม่พบเวลาเดิม';
  byId('qsGuests').innerText = ticket.guest_count;
  byId('qsAhead').innerText = ticket.count_ahead;
  openModal('queueSlipModal');
}

// โหลดรายการคิวแล้วเปิดหน้าจัดการคิว
function openQueueModal() {
  loadQueues();
  openModal('queueModal');
}

// เปิดหน้าต่างคิวและให้กรอกจำนวนลูกค้า
function openIssueQueueModal() {
  openModal('queueModal');
  byId('newQueueGuestCount').focus();
}
let queueVersion = 0;

// อ่านวันที่และตัวเลือกดูประวัติเพื่อใช้ค้นหาคิว
function queueFilters() {
  return new URLSearchParams({
    date: byId('queueDate').value,
    history: byId('queueHistory').checked ? '1' : '0'
  }).toString();
}

// ขอรายการคิวล่าสุดแล้วอัปเดตจำนวนคิวบนหน้าจอ
async function loadQueues() {
  const version = ++queueVersion;
  const filters = queueFilters();
  const container = byId('queueListContainer');
  try {
    const response = await requestFetch('/cashier/queue/list?' + filters, {
      headers: { Accept: 'text/html' }
    });
    const html = await response.text();
    if (version !== queueVersion || filters !== queueFilters()) return;
    if (!response.ok) throw Error('โหลดคิวไม่สำเร็จ');
    if (container.innerHTML !== html) container.innerHTML = html;
    const count = container.querySelector('template').dataset.waiting;
    byId('waitingCountDisplay').innerText = count;
    byId('queueBadge').innerText = count;
  } catch {
    if (version !== queueVersion) return;
    container.innerHTML =
      '<div class="empty" style="padding: 24px; color: var(--danger);">โหลดคิวไม่สำเร็จ</div>';
  }
}

// ส่งจำนวนลูกค้าเพื่อออกบัตรคิวใหม่
async function submitIssueQueue(event) {
  event.preventDefault();
  const data = await requestAction(
    '/cashier/queue/issue',
    Object.fromEntries(new FormData(event.target)),
    event.submitter
  );
  if (data) {
    closeModal('queueModal');
    displayQueueTicket(data.ticket);
    loadQueues();
  }
}

// ส่งคำสั่งเรียกคิว แล้วเล่นเสียงตามเลขคิวที่ได้รับ
async function callQueue(queue_ticket_id) {
  await enableSound();
  const data = await requestAction('/cashier/queue/call', { queue_ticket_id });
  if (data) {
    announceQueue(data.queue_no);
    loadQueues();
  }
}

// ใส่ข้อมูลคิวลงฟอร์มเลือกโต๊ะว่าง
function openSeatModal(queue_ticket_id, queue_no, guest_count) {
  byId('seatQueueTicketId').value = queue_ticket_id;
  byId('seatQueueNo').innerText = queue_no;
  byId('seatQueueGuests').innerText = guest_count;
  resetGuestCounts('seat', guest_count);
  byId('seatBuffetPrice').value = 279;
  closeModal('queueModal');
  openModal('seatQueueModal');
}

// ยืนยันแล้วส่งคำสั่งยกเลิกบัตรคิว
async function cancelQueue(queue_ticket_id) {
  if (!confirm('ยืนยันการยกเลิกบัตรคิวนี้หรือไม่?')) return;
  const data = await requestAction('/cashier/queue/cancel', { queue_ticket_id });
  if (data) loadQueues();
}

// อ่านบัตรคิวเดิมเพื่อแสดงและพิมพ์ซ้ำ
async function reprintQueue(id = lastTicketId) {
  if (!id) return openQueueModal();
  const data = await requestAction('/cashier/queue/ticket/' + encodeURIComponent(id));
  if (data) displayQueueTicket(data.ticket);
}
// อัปเดตหน้าแคชเชียร์
function updateTableControls() {
  renderElapsed();
  const selected = document.querySelector('#seatTableSelect input:checked');
  document.querySelector('#seatQueueModal button[type=submit]').disabled = !selected;
}
const refreshTables = liveRegion(
  ['.grid-50-tables', '.stat-strip', '#seatTableSelect', '#tableAlert'],
  updateTableControls
);
renderElapsed();
setInterval(renderElapsed, 30000);
loadQueues();
setInterval(loadQueues, 5000);
