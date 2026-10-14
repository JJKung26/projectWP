// หาองค์ประกอบ HTML จาก id เพื่อให้ฟังก์ชันอื่นเรียกใช้สั้นลง
function byId(id) {
  return document.getElementById(id);
}

// อ่านชื่อและค่าของช่องกรอกในฟอร์ม
function readForm(form) {
  const data = {};
  for (const [name, value] of new FormData(form)) data[name] = value;
  return data;
}

// รับข้อมูล JSON; ถ้ามี body ให้ส่งเป็น POST
async function requestData(url, body) {
  const options = { headers: { Accept: 'application/json' } };
  if (body) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const data = await response.json();
  data.httpStatus = response.status;
  return data;
}

// ปิดปุ่มระหว่างส่ง และแจ้งเมื่อคำสั่งไม่สำเร็จ
async function requestAction(url, body, button) {
  if (button) button.disabled = true;
  try {
    const data = await requestData(url, body);
    if (data.success) return data;
    alert(data.message);
    if (data.httpStatus === 409) location.reload();
  } catch {
    alert('เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง');
  } finally {
    if (button) button.disabled = false;
  }
}

// แสดงชื่ออาหารเป็นข้อความ แม้ชื่อมีเครื่องหมาย < หรือ >
function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

// เปิดหรือพับรายการอาหาร พร้อมเปลี่ยนข้อความบนปุ่ม
function setOrderDropdown(id, open) {
  const dropdown = byId('dropdown-' + id);
  if (!dropdown) return;
  const button = byId('toggle-btn-' + id);
  dropdown.classList.toggle('open', open);
  button.classList.toggle('collapsed', !open);
  const label = button.querySelector('.toggle-text');
  if (label) label.textContent = open ? 'ซ่อนรายการ' : 'ดูรายการ';
}

function toggleOrderDropdown(id) {
  setOrderDropdown(id, !byId('dropdown-' + id).classList.contains('open'));
}

// ส่งคำสั่งพนักงานทีละครั้ง แล้วรีเฟรชข้อมูล
async function sendStaffAction(url, body, refresh) {
  if (window.staffSending) return;
  window.staffSending = true;
  await requestAction(url, body);
  window.staffSending = false;
  refresh();
}

// เปิดและปิดป๊อปอัป โดยรอให้ CSS เล่นแอนิเมชันก่อนปิด
function dialogOpen(id, state = 'active') {
  const dialog = byId(id);
  clearTimeout(dialog.closeTimer);
  if (!dialog.open) dialog.showModal();
  // อ่านขนาดก่อนใส่ class เพื่อให้แอนิเมชันเริ่มหลังเปิด dialog
  dialog.getBoundingClientRect();
  dialog.classList.add(state);
}

function dialogClose(id, state = 'active') {
  const dialog = byId(id);
  dialog.classList.remove(state);
  dialog.closeTimer = setTimeout(function () {
    dialog.close();
  }, 320);
}

// เลือกวิธีปิดป๊อปอัป และยังไม่ปิดขณะกำลังส่งข้อมูล
function dismissDialog(dialog) {
  if (window.orderSending || dialog.querySelector('button[type=submit]:disabled')) return;
  if (dialog.classList.contains('sheet')) {
    closeSheets();
  } else {
    closeModal(dialog.id);
  }
}
// ปิดเมื่อกดพื้นหลังหรือ Escape โดยใช้แอนิเมชันเดิม
document.addEventListener('click', function (event) {
  if (event.target.matches('dialog.modal-overlay')) dismissDialog(event.target);
});
document.addEventListener(
  'cancel',
  function (event) {
    event.preventDefault();
    dismissDialog(event.target);
  },
  true
);

// ทำเครื่องหมายเมนูพนักงานตามหน้าที่เปิดอยู่
document.addEventListener('DOMContentLoaded', function () {
  for (const link of document.querySelectorAll('.nav-link')) {
    if (location.pathname.startsWith(link.dataset.match)) link.classList.add('active');
  }
});
