// เปลี่ยนข้อมูลบนหน้า แล้วคืนสถานะรายการที่ผู้ใช้เปิดไว้
function replaceLiveContent(page, selectors) {
  const focusedId = document.activeElement.id;
  const expanded = {};
  for (const dropdown of document.querySelectorAll(
    '.round-card-dropdown[id],.cust-round-dropdown[id]'
  )) {
    expanded[dropdown.id] = dropdown.classList.contains('open');
  }
  for (const selector of selectors) {
    const current = document.querySelector(selector);
    const replacement = page.querySelector(selector);
    if (current && replacement) {
      current.innerHTML = replacement.innerHTML;
    }
  }
  for (const id of Object.keys(expanded)) {
    setOrderDropdown(id, expanded[id]);
  }
  if (focusedId) {
    document.getElementById(focusedId)?.focus();
  }
}

// รวมเหตุการณ์ที่มาติดกัน และรอจนผู้ใช้ทำรายการเสร็จก่อนอัปเดต
function liveRegion(socket, selectors, events, afterRefresh) {
  let timer,
    loading = false,
    pending = false,
    retryDelay = 350;
  function busy() {
    if (window.printingDocument || window.orderSending || window.staffSending) {
      return true;
    }
    if (document.querySelector('.modal-overlay.active,.sheet.open')) {
      return true;
    }
    for (const selector of selectors) {
      const current = document.querySelector(selector);
      const focused = document.activeElement;
      if (current && current.contains(focused) && focused.matches('input,select,textarea')) {
        return true;
      }
    }
    return false;
  }
  async function refresh() {
    if (document.getElementById('diningEnded')) {
      return;
    }
    if (loading) {
      return;
    }
    if (busy()) {
      return schedule(1500);
    }
    loading = true;
    pending = false;
    try {
      const response = await requestFetch(location.pathname + location.search, {
        headers: { Accept: 'text/html' }
      });
      if (response.status === 400 && socket.auth?.token) {
        return diningEnded();
      }
      if (!response.ok || response.redirected) {
        throw new Error('กรุณาตรวจการเชื่อมต่อหรือเข้าสู่ระบบอีกครั้ง');
      }
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (busy()) {
        pending = true;
        return;
      }
      replaceLiveContent(next, selectors);
      if (afterRefresh) {
        afterRefresh();
      }
      retryDelay = 350;
      document.getElementById('liveError')?.remove();
    } catch (err) {
      pending = true;
      retryDelay = Math.min(Math.max(2000, retryDelay * 2), 10000);
      if (!document.getElementById('liveError')) {
        const p = document.createElement('p');
        p.id = 'liveError';
        p.textContent = ['TimeoutError', 'TypeError'].includes(err.name)
          ? 'อัปเดตข้อมูลไม่ได้ กำลังลองเชื่อมต่อใหม่'
          : err.message;
        p.setAttribute('role', 'status');
        document.body.appendChild(p);
      }
    } finally {
      loading = false;
      if (pending) {
        schedule();
      }
    }
  }
  // ใช้ตัวตั้งเวลาเดียว รอเมื่อเปิดฟอร์ม และลองใหม่เมื่อเชื่อมต่อไม่ได้
  function schedule(delay = retryDelay) {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(refresh, delay);
  }
  for (const event of events) {
    socket.on(event, () => schedule());
  }
  socket.on('connect', () => {
    retryDelay = 350;
    schedule();
  });
  socket.on('connect_error', () => schedule());
  return () => schedule();
}

function diningEnded() {
  if (document.getElementById('diningEnded')) {
    return;
  }
  document.querySelectorAll('button,input').forEach((el) => (el.disabled = true));
  const box = document.createElement('div');
  box.id = 'diningEnded';
  box.className = 'card';
  box.style.cssText = 'position:fixed;inset:20% 5% auto;z-index:9999;text-align:center';
  box.textContent = 'รอบบริการนี้จบแล้ว กรุณาติดต่อพนักงาน';
  document.body.appendChild(box);
}
