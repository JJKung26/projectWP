// คำสั่งส่งข้อมูลและควบคุมหน้าต่างที่ทุกหน้าใช้ร่วมกัน
// หาองค์ประกอบจาก id ใช้ร่วมกันทุกหน้า
function byId(id) {
  return document.getElementById(id);
}

// หยุดรอเมื่อเครือข่ายค้าง เพื่อให้ finally ปลดล็อกปุ่มได้
function requestFetch(url, options = {}) {
  options.signal = AbortSignal.timeout(12000);
  return fetch(url, options);
}

// ส่ง body เป็น POST; ถ้าไม่มี body ให้อ่านข้อมูลด้วย GET
async function requestData(url, body) {
  const options = {};
  if (body !== undefined) {
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await requestFetch(url, options);
  const data = await response.json();
  data.httpStatus = response.status;
  return data;
}

// คำสั่งทั่วไป: ส่งข้อมูล แล้วแจ้งข้อผิดพลาดในที่เดียว
async function requestAction(url, body, button) {
  if (button && button.disabled) return null;
  if (button) button.disabled = true;
  try {
    const data = await requestData(url, body);
    if (data.success) return data;
    alert(data.message || 'ทำรายการไม่สำเร็จ');
  } catch {
    alert('เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง');
  } finally {
    if (button) button.disabled = false;
  }
  return null;
}

// อ่านข้อมูลชั่วคราวที่เก็บไว้ในแท็บนี้
function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

// บันทึกหรือลบข้อมูลชั่วคราวในแท็บนี้
function writeStorage(key, value) {
  try {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {}
}

// สลับเปิดหรือซ่อนรายการอาหารของออเดอร์
function toggleOrderDropdown(orderId, customer = false) {
  const dropdown = byId((customer ? 'cust-dropdown-' : 'dropdown-') + orderId);
  if (dropdown) setOrderDropdown(dropdown.id, !dropdown.classList.contains('open'));
}

// กำหนดสถานะรายการและข้อความบนปุ่มเปิดหรือซ่อน
function setOrderDropdown(id, open) {
  const dropdown = byId(id);
  let buttonId = id.replace('dropdown-', 'toggle-btn-');
  if (id.startsWith('cust-')) buttonId = id.replace('cust-dropdown-', 'cust-btn-');
  const button = byId(buttonId);
  if (!dropdown) return;
  dropdown.classList.toggle('open', open);
  if (!button) return;
  button.classList.toggle('collapsed', !open);
  const label = button.querySelector('.toggle-text');
  if (label) label.textContent = open ? 'ซ่อนรายการ' : 'ดูรายการ';
}

// ส่งคำสั่งพนักงาน ป้องกันกดซ้ำ แล้วอัปเดตหน้าจอ
async function sendStaffAction(url, body, refresh) {
  if (window.staffSending) return;
  window.staffSending = true;
  const controls = document.querySelectorAll('.container button:not(:disabled)');
  for (const button of controls) button.disabled = true;
  try {
    await requestAction(url, body);
  } finally {
    window.staffSending = false;
    for (const button of controls) button.disabled = false;
    refresh();
  }
}

// เบราว์เซอร์จัดการโฟกัสและปุ่ม Tab ภายในหน้าต่างให้
function dialogOpen(id, state = 'active') {
  const dialog = byId(id);
  dialog.classList.add(state);
  if (!dialog.open) dialog.showModal();
}

// ปิดหน้าต่างและเอาคลาสแสดงผลออก
function dialogClose(id, state = 'active') {
  const dialog = byId(id);
  dialog.close();
  dialog.classList.remove(state);
}

// ปิดหน้าต่างเมื่อไม่มีงานส่งข้อมูลหรือพิมพ์ค้างอยู่
function closeActiveDialog(dialog) {
  if (window.orderSending || window.printingDocument) return;
  if (dialog.querySelector('button[type=submit]:disabled')) return;
  if (dialog.classList.contains('sheet')) {
    closeSheets();
  } else {
    closeModal(dialog.id);
  }
}
// ปิดหน้าต่างเมื่อคลิกพื้นที่ด้านนอก
function dismissDialog(event) {
  const dialog = event.target;
  if (dialog.matches('.modal-overlay.active')) closeActiveDialog(dialog);
  if (!dialog.matches('.sheet.open')) return;
  const rect = dialog.getBoundingClientRect();
  const insideX = event.clientX >= rect.left && event.clientX <= rect.right;
  const insideY = event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!insideX || !insideY) closeActiveDialog(dialog);
}
document.addEventListener('click', dismissDialog);
// รับปุ่ม Escape แล้วปิดหน้าต่างที่ใช้งานอยู่
function cancelDialog(event) {
  event.preventDefault();
  closeActiveDialog(event.target);
}
// รับ Escape จาก dialog ทุกอันผ่าน document (cancel ไม่ส่งต่อแบบ bubble)
document.addEventListener('cancel', cancelDialog, true);
