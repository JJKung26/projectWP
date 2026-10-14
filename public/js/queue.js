// อ่านรหัสบัตรคิวล่าสุดที่จำไว้ เพื่อเปิดดูหรือพิมพ์ซ้ำ
let lastTicketId = sessionStorage.getItem('lastQueueTicket') || '';

// จำบัตรคิวล่าสุดและใส่ข้อมูลลงในใบสำหรับพิมพ์
function displayQueueTicket(ticket) {
  lastTicketId = ticket.queue_ticket_id;
  sessionStorage.setItem('lastQueueTicket', lastTicketId);
  byId('qsQueueNo').textContent = ticket.queue_no;
  byId('qsDate').textContent = ticket.queue_date;
  const created = new Date(ticket.created_at.replace(' ', 'T') + 'Z');
  byId('qsTime').textContent = created.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok'
  });
  byId('qsGuests').textContent = ticket.guest_count;
  byId('qsAhead').textContent = ticket.count_ahead;
  openModal('queueSlipModal');
}

// เปิดป๊อปอัปจัดการคิว หรือเลื่อนไปช่องออกคิวใหม่
function openQueueModal() {
  loadQueues();
  openModal('queueModal');
}

function openIssueQueueModal() {
  openQueueModal();
  byId('newQueueGuestCount').focus();
}

// โหลดคิวตามวันและสถานะ แล้วอัปเดตรายการกับจำนวนคิวรอ
async function loadQueues() {
  const history = byId('queueHistory').checked ? '1' : '0';
  const filters = new URLSearchParams({
    date: byId('queueDate').value,
    history
  });
  try {
    const response = await fetch('/cashier/queue/list?' + filters, {
      headers: { Accept: 'text/html' }
    });
    if (response.redirected) {
      location.assign('/login');
      return;
    }
    if (!response.ok) throw Error('โหลดคิวไม่สำเร็จ');
    byId('queueListContainer').innerHTML = await response.text();
    const count = byId('queueListContainer').querySelector('template').dataset.waiting;
    byId('waitingCountDisplay').textContent = count;
    byId('queueBadge').textContent = count;
  } catch {
    byId('queueListContainer').textContent = 'โหลดคิวไม่ได้ กรุณากดรีเฟรช';
  }
}

// ส่งจำนวนลูกค้าเพื่อออกคิวใหม่ แล้วแสดงบัตรคิว
async function submitIssueQueue(event) {
  event.preventDefault();
  const body = { guest_count: byId('newQueueGuestCount').value };
  const data = await requestAction('/cashier/queue/issue', body, event.submitter);
  if (data) {
    displayQueueTicket(data.ticket);
    loadQueues();
  }
}

// เปลี่ยนคิวเป็นเรียกแล้ว และเล่นเสียงประกาศหมายเลข
async function callQueue(ticketId) {
  await enableSound();
  const data = await requestAction('/cashier/queue/call', {
    queue_ticket_id: ticketId
  });
  if (data) {
    announceQueue(data.queue_no);
    loadQueues();
  }
}

// ใส่เลขคิวและจำนวนคนในฟอร์มจัดโต๊ะ
function openSeatModal(ticketId, number, count) {
  byId('seatQueueTicketId').value = ticketId;
  byId('seatQueueNo').textContent = number;
  byId('seatQueueGuests').textContent = count;
  resetGuestCounts('seat', count);
  openModal('seatQueueModal');
}

// ยืนยันยกเลิกคิว แล้วโหลดรายการใหม่
async function cancelQueue(ticketId) {
  if (!confirm('ยกเลิกบัตรคิวนี้?')) return;
  const data = await requestAction('/cashier/queue/cancel', {
    queue_ticket_id: ticketId
  });
  if (data) loadQueues();
}

// อ่านบัตรคิวเดิมเพื่อเปิดดูหรือพิมพ์ซ้ำ
async function reprintQueue(id = lastTicketId) {
  if (!id) {
    openQueueModal();
    return;
  }
  const data = await requestAction('/cashier/queue/ticket/' + id);
  if (data) displayQueueTicket(data.ticket);
}
// โหลดคิวเมื่อเปิดหน้าและอัปเดตทุก 5 วินาที
loadQueues();
setInterval(loadQueues, 5000);
