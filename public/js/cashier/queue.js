let lastTicketId = '';
try {
    lastTicketId = sessionStorage.getItem('lastQueueTicket') || '';
} catch {}

function openQueueModal() {
    loadQueues();
    openModal('queueModal');
}

function openIssueQueueModal() {
    openModal('queueModal');
    document.getElementById('newQueueGuestCount').focus();
}

let queueTimer,
    queueVersion = 0;
function loadQueues() {
    clearTimeout(queueTimer);
    queueTimer = setTimeout(loadQueueData, 250);
}
async function loadQueueData() {
    const version = ++queueVersion;
    const date = document.getElementById('queueDate').value;
    const history = document.getElementById('queueHistory').checked;
    const container = document.getElementById('queueListContainer');

    try {
        const res = await requestFetch(
            '/cashier/queue/list?' + new URLSearchParams({ date, history: history ? '1' : '0' })
        );
        const data = await res.json();
        if (
            version !== queueVersion ||
            date !== document.getElementById('queueDate').value ||
            history !== document.getElementById('queueHistory').checked
        )
            return;
        if (data.success) {
            document.getElementById('waitingCountDisplay').innerText = data.totalWaiting;
            const badge = document.getElementById('queueBadge');
            if (badge) badge.innerText = data.totalWaiting;

            if (data.queues.length === 0) {
                container.innerHTML =
                    '<div class="empty" style="padding: 28px;">ยังไม่มีคิวรอ</div>';
                return;
            }

            let html = '';
            data.queues.forEach(q => {
                const isCalled = q.queue_status === 'CALLED';
                const actionable =
                    q.queue_date === data.today && ['WAITING', 'CALLED'].includes(q.queue_status);
                const status = {
                    WAITING: 'รอเรียก',
                    CALLED: 'เรียกแล้ว รอลูกค้ามา',
                    SEATED: 'นั่งแล้ว',
                    CANCELLED: 'ยกเลิกแล้ว'
                }[q.queue_status];
                html += `
                <div class="queue-card-item${isCalled ? ' called' : ''}">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="queue-no-badge">${q.queue_no}</div>
                        <div>
                            <div style="font-weight: 500;">${q.guest_count} ท่าน</div>
                            <div style="font-size: 0.8rem; color: var(--ink-3);">${status}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="reprintQueue('${q.queue_ticket_id}')">พิมพ์ซ้ำ</button>
                        ${
                            actionable
                                ? `<button class="btn btn-secondary btn-sm" onclick="callQueue('${q.queue_ticket_id}')">เรียกคิว</button>
                        <button class="btn btn-dark btn-sm" onclick="openSeatModal('${q.queue_ticket_id}', '${q.queue_no}', ${q.guest_count})">จัดโต๊ะ</button>
                        <button class="btn btn-ghost btn-sm" style="color: var(--danger);" onclick="cancelQueue('${q.queue_ticket_id}')">ยกเลิก</button>`
                                : ''
                        }
                    </div>
                </div>
            `;
            });
            container.innerHTML = html;
        } else {
            container.textContent = data.message;
        }
    } catch (err) {
        if (version !== queueVersion) return;
        container.innerHTML =
            '<div class="empty" style="padding: 24px; color: var(--danger);">โหลดคิวไม่สำเร็จ</div>';
    }
}

async function submitIssueQueue(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn.disabled) return;
    btn.disabled = true;
    const guest_count = document.getElementById('newQueueGuestCount').value;

    try {
        const res = await requestFetch('/cashier/queue/issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guest_count })
        });
        const data = await res.json();
        if (data.success) {
            // Show Queue Ticket Slip
            document.getElementById('qsQueueNo').innerText = data.ticket.queue_no;
            document.getElementById('qsDate').innerText = data.ticket.queue_date;
            document.getElementById('qsTime').innerText = data.ticket.created_at
                ? new Date(data.ticket.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString(
                      'th-TH',
                      { timeZone: 'Asia/Bangkok' }
                  )
                : 'ไม่พบเวลาเดิม';
            lastTicketId = data.ticket.queue_ticket_id;
            document.getElementById('qsGuests').innerText = data.ticket.guest_count;
            document.getElementById('qsAhead').innerText = data.ticket.count_ahead;
            try {
                sessionStorage.setItem('lastQueueTicket', lastTicketId);
            } catch {}

            closeModal('queueModal');
            openModal('queueSlipModal');
            loadQueues();
        } else {
            alert(data.message || 'เกิดข้อผิดพลาดในการออกคิว');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการออกบัตรคิว');
    } finally {
        btn.disabled = false;
    }
}

async function callQueue(queue_ticket_id) {
    try {
        await enableSound();
        const res = await requestFetch('/cashier/queue/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queue_ticket_id })
        });
        const data = await res.json();
        if (data.success) {
            loadQueues();
        } else {
            alert(data.message || 'เรียกคิวไม่สำเร็จ');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการเรียกคิว');
    }
}

function openSeatModal(queue_ticket_id, queue_no, guest_count) {
    document.getElementById('seatQueueTicketId').value = queue_ticket_id;
    document.getElementById('seatQueueNo').innerText = queue_no;
    document.getElementById('seatQueueGuests').innerText = guest_count;
    resetGuestCounts('seat', guest_count);
    document.getElementById('seatBuffetPrice').value = 279;
    closeModal('queueModal');
    openModal('seatQueueModal');
}

async function submitSeatQueue(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn.disabled) return;
    btn.disabled = true;
    const queue_ticket_id = document.getElementById('seatQueueTicketId').value;
    const table_id = document.querySelector('#seatTableSelect input:checked')?.value || '';
    const buffet_price = document.getElementById('seatBuffetPrice').value;
    const child_price = document.getElementById('seatChildPrice').value;

    if (!table_id) {
        btn.disabled = false;
        alert('กรุณาเลือกโต๊ะว่าง');
        return;
    }

    try {
        const res = await requestFetch('/cashier/queue/seat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                queue_ticket_id,
                table_id,
                ...guestCounts('seat'),
                buffet_price,
                child_price
            })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('seatQueueModal');
            displaySlipData(data);
            openModal('slipModal');
        } else {
            alert(data.message || 'ไม่สามารถจัดคิวเข้าโต๊ะได้');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการจัดคิวเข้าโต๊ะ');
    } finally {
        btn.disabled = false;
    }
}

async function cancelQueue(queue_ticket_id) {
    if (!confirm('ยืนยันการยกเลิกบัตรคิวนี้หรือไม่?')) return;
    try {
        const res = await requestFetch('/cashier/queue/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queue_ticket_id })
        });
        const data = await res.json();
        if (data.success) {
            loadQueues();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการยกเลิกคิว');
    }
}

async function reprintQueue(id = lastTicketId) {
    if (!id) return openQueueModal();
    try {
        const res = await requestFetch('/cashier/queue/ticket/' + encodeURIComponent(id));
        const data = await res.json();
        if (!data.success) return alert(data.message);
        const t = data.ticket;
        lastTicketId = t.queue_ticket_id;
        try {
            sessionStorage.setItem('lastQueueTicket', lastTicketId);
        } catch {}
        document.getElementById('qsQueueNo').innerText = t.queue_no;
        document.getElementById('qsDate').innerText = t.queue_date;
        document.getElementById('qsTime').innerText = t.created_at
            ? new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('th-TH', {
                  timeZone: 'Asia/Bangkok'
              })
            : 'ไม่พบเวลาเดิม';
        document.getElementById('qsGuests').innerText = t.guest_count;
        document.getElementById('qsAhead').innerText = t.count_ahead;
        openModal('queueSlipModal');
    } catch (err) {
        alert('โหลดบัตรคิวไม่สำเร็จ');
    }
}
