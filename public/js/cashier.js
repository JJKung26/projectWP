// จำนวนลูกค้าและหน้าต่าง
function updateGuestTotal(prefix) {
  let total = 0;
  for (const type of ['Adult', 'Child', 'FreeChild']) {
    total += Number(byId(prefix + type + 'Count').value);
  }
  byId(prefix + 'GuestTotal').textContent = total;
}

function resetGuestCounts(prefix, adults) {
  byId(prefix + 'AdultCount').value = adults;
  byId(prefix + 'ChildCount').value = 0;
  byId(prefix + 'FreeChildCount').value = 0;
  byId(prefix + 'ChildPrice').value = 179;
  updateGuestTotal(prefix);
}

function stepInput(id, delta) {
  const el = byId(id);
  const next = (parseInt(el.value, 10) || 0) + delta;
  el.value = Math.min(Number(el.max || 99), Math.max(Number(el.min || 0), next));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderElapsed() {
  document.querySelectorAll('.elapsed').forEach((el) => {
    const started = new Date(el.dataset.started.replace(' ', 'T') + 'Z');
    const mins = Math.max(0, Math.floor((Date.now() - started) / 60000));
    if (mins < 60) {
      el.textContent = `${mins} นาที`;
    } else if (mins < 1440) {
      el.textContent = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} ชม.`;
    } else {
      el.textContent = `${Math.floor(mins / 1440)} วัน`;
    }
  });
}

function openModal(id) {
  document.querySelectorAll('.modal-overlay.active').forEach((el) => dialogClose(el.id));
  dialogOpen(id);
}

function closeModal(id) {
  dialogClose(id);
  if (['slipModal', 'queueSlipModal', 'openTableModal', 'seatQueueModal'].includes(id)) {
    refreshTables();
  }
}
// เปิดและจัดการโต๊ะ
let selectedTable = {};

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
function submitOpenTable(e) {
  return submitTable(e, 'open');
}

async function submitTable(e, prefix) {
  e.preventDefault();
  const btn = e.submitter;
  if (btn.disabled) {
    return;
  }
  const fromQueue = prefix === 'seat';
  const body = Object.fromEntries(new FormData(e.target));
  if (fromQueue && !body.table_id) {
    return alert('กรุณาเลือกโต๊ะว่าง');
  }
  btn.disabled = true;
  try {
    const data = await postData(fromQueue ? '/cashier/queue/seat' : '/cashier/open-table', body);
    if (!data.success) {
      return alert(
        data.message || (fromQueue ? 'ไม่สามารถจัดคิวเข้าโต๊ะได้' : 'เกิดข้อผิดพลาดในการเปิดโต๊ะ')
      );
    }
    closeModal(fromQueue ? 'seatQueueModal' : 'openTableModal');
    displaySlipData(data);
    openModal('slipModal');
  } catch {
    alert(
      fromQueue ? 'เกิดข้อผิดพลาดในการจัดคิวเข้าโต๊ะ' : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
    );
  } finally {
    btn.disabled = false;
  }
}

async function resetTableStatus() {
  const table = { ...selectedTable };
  const message = 'ยกเลิกรอบบริการที่ยังไม่มีอาหาร';
  if (!confirm('โต๊ะ ' + table.tableNo + ': ' + message + ' และเปลี่ยนเป็นว่าง?')) {
    return;
  }
  try {
    const data = await postData('/cashier/reset-table', {
      table_id: table.tableId,
      expected_status: table.status,
      expected_session_id: table.sessionId
    });
    if (!data.success) {
      return alert(data.message);
    }
    closeModal('occupiedTableModal');
    refreshTables();
  } catch {
    alert('เกิดข้อผิดพลาดในการรีเซ็ตโต๊ะ');
  }
}
// ใบเปิดโต๊ะ
let currentCustomerUrl = '';

async function showReceiptSlipModal() {
  closeModal('occupiedTableModal');
  try {
    const data = await getData(`/cashier/qr/${selectedTable.qrToken}`);
    if (!data.success) {
      return alert(data.message || 'ไม่สามารถโหลดข้อมูลโต๊ะได้');
    }
    displaySlipData(data);
    openModal('slipModal');
  } catch {
    alert('ไม่สามารถโหลดข้อมูลใบเปิดโต๊ะได้');
  }
}

function displaySlipData(data) {
  const start = new Date(data.started_at.replace(' ', 'T') + 'Z');
  const end = new Date(start.getTime() + 120 * 60000);
  const date = (value) => value.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const time = (value) =>
    value.toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  // ชื่อช่องบนใบเปิดโต๊ะและค่าที่แสดง ใช้ลูปเดียวแทนการสั่งซ้ำทีละช่อง
  const fields = {
    TableNo: data.table_no,
    StartedAt: date(start),
    StartTime: time(start),
    EndTime: time(end),
    EndDate: date(start) === date(end) ? '' : 'หมดเวลาในวันที่ ' + date(end),
    SessionId: data.session_id.slice(0, 8).toUpperCase(),
    GuestCount: data.guest_count,
    BuffetPrice: data.buffet_price,
    AdultCount: data.guest_count - (data.child_count || 0) - (data.free_child_count || 0),
    ChildCount: data.child_count || 0,
    ChildPrice: data.child_price ?? 179,
    FreeChildCount: data.free_child_count || 0,
    UrlText: data.customer_url
  };
  for (const name in fields) {
    byId('slip' + name).innerText = fields[name];
  }
  byId('slipChildRow').hidden = !data.child_count;
  byId('slipFreeChildRow').hidden = !data.free_child_count;
  const amounts = {
    EstTotal: 'subtotal',
    Vat: 'taxAmount',
    Rounding: 'roundingAmount',
    GrandTotal: 'netAmount'
  };
  for (const name in amounts) {
    const value = data.buffet_totals[amounts[name]];
    byId('slip' + name).innerText = Number(value).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  byId('slipQrImg').src = data.qr_image;
  currentCustomerUrl = data.customer_url;
}

function printSlip() {
  printDocument(
    byId('slipModal').classList.contains('active') ? 'slipPrintArea' : 'queueSlipPrintArea'
  );
}

async function copySlipUrl() {
  if (!currentCustomerUrl) {
    return;
  }
  if (!navigator.clipboard) {
    return prompt('คัดลอกลิงก์:', currentCustomerUrl);
  }
  try {
    await navigator.clipboard.writeText(currentCustomerUrl);
    alert('คัดลอกลิงก์เรียบร้อยแล้ว: ' + currentCustomerUrl);
  } catch {
    prompt('คัดลอกลิงก์:', currentCustomerUrl);
  }
}
// จัดการคิว
let lastTicketId = readStorage('lastQueueTicket') || '';

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

function openQueueModal() {
  loadQueues();
  openModal('queueModal');
}

function openIssueQueueModal() {
  openModal('queueModal');
  byId('newQueueGuestCount').focus();
}
let queueTimer,
  queueVersion = 0;

function loadQueues() {
  clearTimeout(queueTimer);
  queueTimer = setTimeout(loadQueueData, 250);
}

async function loadQueueData() {
  const version = ++queueVersion;
  const date = byId('queueDate').value;
  const history = byId('queueHistory').checked;
  const container = byId('queueListContainer');
  try {
    const data = await getData(
      '/cashier/queue/list?' + new URLSearchParams({ date, history: history ? '1' : '0' })
    );
    if (
      version !== queueVersion ||
      date !== byId('queueDate').value ||
      history !== byId('queueHistory').checked
    ) {
      return;
    }
    if (!data.success) {
      container.textContent = data.message;
      return;
    }
    byId('waitingCountDisplay').innerText = data.totalWaiting;
    const badge = byId('queueBadge');
    if (badge) {
      badge.innerText = data.totalWaiting;
    }
    if (data.queues.length === 0) {
      container.innerHTML = '<div class="empty" style="padding: 28px;">ยังไม่มีคิวรอ</div>';
      return;
    }
    container.innerHTML = queueCards(data.queues, data.today);
  } catch {
    if (version !== queueVersion) {
      return;
    }
    container.innerHTML =
      '<div class="empty" style="padding: 24px; color: var(--danger);">โหลดคิวไม่สำเร็จ</div>';
  }
}

// วาดบัตรคิวจากข้อมูล แสดงปุ่มจัดการเฉพาะคิวที่ยังรอในวันนี้
function queueCards(queues, today) {
  const labels = {
    WAITING: 'รอเรียก',
    CALLED: 'เรียกแล้ว รอลูกค้ามา',
    SEATED: 'นั่งแล้ว',
    CANCELLED: 'ยกเลิกแล้ว'
  };
  let html = '';
  for (const q of queues) {
    let buttons = '';
    if (q.queue_date === today && ['WAITING', 'CALLED'].includes(q.queue_status)) {
      buttons = `<button class="btn btn-secondary btn-sm" onclick="callQueue('${q.queue_ticket_id}')">เรียกคิว</button>
        <button class="btn btn-dark btn-sm" onclick="openSeatModal('${q.queue_ticket_id}', '${q.queue_no}', ${q.guest_count})">จัดโต๊ะ</button>
        <button class="btn btn-ghost btn-sm" style="color: var(--danger);" onclick="cancelQueue('${q.queue_ticket_id}')">ยกเลิก</button>`;
    }
    html += `<div class="queue-card-item${q.queue_status === 'CALLED' ? ' called' : ''}">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div class="queue-no-badge">${q.queue_no}</div>
        <div>
          <div style="font-weight: 500;">${q.guest_count} ท่าน</div>
          <div style="font-size: 0.8rem; color: var(--ink-3);">${labels[q.queue_status]}</div>
        </div>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-sm" onclick="reprintQueue('${q.queue_ticket_id}')">พิมพ์ซ้ำ</button>
        ${buttons}
      </div>
    </div> `;
  }
  return html;
}

async function submitIssueQueue(e) {
  e.preventDefault();
  const btn = e.submitter;
  if (btn.disabled) {
    return;
  }
  btn.disabled = true;
  try {
    const data = await postData('/cashier/queue/issue', Object.fromEntries(new FormData(e.target)));
    if (!data.success) {
      return alert(data.message || 'เกิดข้อผิดพลาดในการออกคิว');
    }
    closeModal('queueModal');
    displayQueueTicket(data.ticket);
    loadQueues();
  } catch {
    alert('เกิดข้อผิดพลาดในการออกบัตรคิว');
  } finally {
    btn.disabled = false;
  }
}

async function callQueue(queue_ticket_id) {
  try {
    await enableSound();
    const data = await postData('/cashier/queue/call', { queue_ticket_id });
    if (!data.success) {
      return alert(data.message || 'เรียกคิวไม่สำเร็จ');
    }
    loadQueues();
  } catch {
    alert('เกิดข้อผิดพลาดในการเรียกคิว');
  }
}

function openSeatModal(queue_ticket_id, queue_no, guest_count) {
  byId('seatQueueTicketId').value = queue_ticket_id;
  byId('seatQueueNo').innerText = queue_no;
  byId('seatQueueGuests').innerText = guest_count;
  resetGuestCounts('seat', guest_count);
  byId('seatBuffetPrice').value = 279;
  closeModal('queueModal');
  openModal('seatQueueModal');
}

function submitSeatQueue(e) {
  return submitTable(e, 'seat');
}

async function cancelQueue(queue_ticket_id) {
  if (!confirm('ยืนยันการยกเลิกบัตรคิวนี้หรือไม่?')) {
    return;
  }
  try {
    const data = await postData('/cashier/queue/cancel', { queue_ticket_id });
    if (!data.success) {
      return alert(data.message);
    }
    loadQueues();
  } catch {
    alert('เกิดข้อผิดพลาดในการยกเลิกคิว');
  }
}

async function reprintQueue(id = lastTicketId) {
  if (!id) {
    return openQueueModal();
  }
  try {
    const data = await getData('/cashier/queue/ticket/' + encodeURIComponent(id));
    if (!data.success) {
      return alert(data.message);
    }
    displayQueueTicket(data.ticket);
  } catch {
    alert('โหลดบัตรคิวไม่สำเร็จ');
  }
}
// อัปเดตหน้าแคชเชียร์
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
socket.on('connect', loadQueues);
socket.on('queue-updated', loadQueues);
socket.on('queue-called', (data) => {
  byId('queueNotice').textContent = 'เรียกคิว ' + data.queue_no + ' แล้ว';
  announceQueue(data.queue_no);
});
