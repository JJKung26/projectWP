function guestCounts(prefix) {
    return {
        adult_count: document.getElementById(prefix + 'AdultCount').value,
        child_count: document.getElementById(prefix + 'ChildCount').value,
        free_child_count: document.getElementById(prefix + 'FreeChildCount').value
    };
}
function updateGuestTotal(prefix) {
    document.getElementById(prefix + 'GuestTotal').textContent = Object.values(
        guestCounts(prefix)
    ).reduce((sum, count) => sum + Number(count), 0);
}
function resetGuestCounts(prefix, adults) {
    document.getElementById(prefix + 'AdultCount').value = adults;
    document.getElementById(prefix + 'ChildCount').value = 0;
    document.getElementById(prefix + 'FreeChildCount').value = 0;
    document.getElementById(prefix + 'ChildPrice').value = 179;
    updateGuestTotal(prefix);
}
function stepInput(id, delta) {
    const el = document.getElementById(id);
    const next = (parseInt(el.value, 10) || 0) + delta;
    el.value = Math.min(Number(el.max || 99), Math.max(Number(el.min || 0), next));
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

// started_at is stored as UTC by SQLite CURRENT_TIMESTAMP
function renderElapsed() {
    document.querySelectorAll('.elapsed').forEach(el => {
        const started = new Date(el.dataset.started.replace(' ', 'T') + 'Z');
        const mins = Math.max(0, Math.floor((Date.now() - started) / 60000));
        el.textContent =
            mins < 60
                ? `${mins} นาที`
                : mins < 1440
                  ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')} ชม.`
                  : `${Math.floor(mins / 1440)} วัน`;
    });
}

// Modal Helpers
function openModal(id) {
    document.querySelectorAll('.modal-overlay.active').forEach(el => dialogClose(el.id));
    dialogOpen(id);
}
function closeModal(id) {
    dialogClose(id);
    if (['slipModal', 'queueSlipModal', 'openTableModal', 'seatQueueModal'].includes(id)) {
        refreshTables();
    }
}
