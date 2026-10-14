// อ่านข้อมูลใหม่ทุก 5 วินาที และเปลี่ยนเฉพาะส่วนที่กำหนด
// พักการรีเฟรชขณะกรอกฟอร์ม เปิดป๊อปอัป ส่งข้อมูล หรือพิมพ์
function liveBusy() {
  return (
    window.staffSending ||
    window.printingDocument ||
    window.orderSending ||
    document.querySelector('dialog[open]') ||
    document.activeElement.matches('input,select,textarea')
  );
}

// โหลดหน้าเดิมและเปลี่ยนเฉพาะกลุ่ม HTML ที่ระบุ
function liveRegion(selectors, afterRefresh) {
  let loading = false;
  async function refresh() {
    if (loading || liveBusy()) return;
    loading = true;
    try {
      const response = await fetch(location.href, {
        headers: { Accept: 'text/html' }
      });
      if (response.status === 400) {
        clearInterval(timer);
        diningEnded();
        return;
      }
      if (response.redirected) {
        location.assign('/login');
        return;
      }
      if (!response.ok) return;
      // แปลง HTML ที่โหลดมาเป็น document เพื่อหยิบส่วนที่ต้องการ
      const html = await response.text();
      const page = new DOMParser().parseFromString(html, 'text/html');
      if (liveBusy()) return;
      const dropdowns = document.querySelectorAll('.order-dropdown');
      for (const selector of selectors) {
        const current = document.querySelector(selector);
        const next = page.querySelector(selector);
        if (current.innerHTML !== next.innerHTML) current.innerHTML = next.innerHTML;
      }
      // จำว่าผู้ใช้เปิดหรือพับรายการใดไว้ก่อนเปลี่ยนข้อมูล
      for (const dropdown of dropdowns) {
        const open = dropdown.classList.contains('open');
        setOrderDropdown(dropdown.dataset.order, open);
      }
      if (afterRefresh) afterRefresh();
    } catch (error) {
      console.warn('อัปเดตข้อมูลไม่ได้:', error.message);
    } finally {
      loading = false;
    }
  }
  // ตั้งให้อัปเดตทุก 5 วินาที และคืนฟังก์ชันไว้เรียกเองได้
  const timer = setInterval(refresh, 5000);
  return refresh;
}

// ปิดป๊อปอัป ปิดปุ่ม และแจ้งลูกค้าเมื่อรอบบริการจบ
function diningEnded() {
  for (const dialog of document.querySelectorAll('dialog[open]')) {
    dialog.close();
  }
  for (const button of document.querySelectorAll('button,input')) {
    button.disabled = true;
  }
  const notice = document.createElement('div');
  notice.id = 'diningEnded';
  notice.className = 'card dining-ended';
  notice.textContent = 'รอบบริการนี้จบแล้ว กรุณาติดต่อพนักงาน';
  document.body.appendChild(notice);
}
