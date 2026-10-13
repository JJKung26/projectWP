// ดึงข้อมูลใหม่เป็นระยะโดยคงหน้าต่างและรายการที่เปิดไว้
// เปลี่ยนรายการ โดยเก็บรายการที่เปิดอยู่และโฟกัสเดิม
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
    if (current && replacement && current.innerHTML !== replacement.innerHTML) {
      current.innerHTML = replacement.innerHTML;
    }
  }
  for (const id in expanded) setOrderDropdown(id, expanded[id]);
  if (focusedId) document.getElementById(focusedId)?.focus();
}

// ตรวจว่ากำลังกรอกข้อมูล ส่งคำสั่ง หรือพิมพ์อยู่หรือไม่
function liveBusy() {
  if (window.printingDocument || window.orderSending || window.staffSending) return true;
  if (document.querySelector('.modal-overlay.active,.sheet.open')) return true;
  return document.activeElement.matches('input,select,textarea');
}

// ดึงข้อมูลทุก 5 วินาที; เว้นไว้ขณะกรอกฟอร์มหรือทำรายการ
function liveRegion(selectors, afterRefresh) {
  let loading = false;
  async function refresh() {
    if (document.getElementById('diningEnded')) return clearInterval(timer);
    if (loading || liveBusy()) return;
    loading = true;
    try {
      const response = await requestFetch(location.pathname + location.search, {
        headers: { Accept: 'text/html' }
      });
      if (response.status === 400) return diningEnded();
      if (!response.ok || response.redirected) throw Error('โหลดข้อมูลไม่สำเร็จ');
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (liveBusy()) return;
      replaceLiveContent(next, selectors);
      if (afterRefresh) afterRefresh();
    } catch (error) {
      console.warn('อัปเดตข้อมูลไม่ได้:', error.message);
    } finally {
      loading = false;
    }
  }
  const timer = setInterval(refresh, 5000);
  return refresh;
}

// ปิดหน้าต่าง ปิดปุ่มใช้งาน และแจ้งว่ารอบบริการจบแล้ว
function diningEnded() {
  if (document.getElementById('diningEnded')) return;
  for (const dialog of document.querySelectorAll('dialog[open]')) {
    dialog.close();
    dialog.classList.remove('open', 'active');
  }
  for (const control of document.querySelectorAll('button,input')) control.disabled = true;
  const box = document.createElement('div');
  box.id = 'diningEnded';
  box.className = 'card';
  box.style.cssText = 'position:fixed;inset:20% 5% auto;z-index:9999;text-align:center';
  box.textContent = 'รอบบริการนี้จบแล้ว กรุณาติดต่อพนักงาน';
  document.body.appendChild(box);
}
