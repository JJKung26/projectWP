// หาองค์ประกอบจาก id ใช้ร่วมกันทุกหน้า
function byId(id) {
  return document.getElementById(id);
}

// หยุดรอเมื่อเครือข่ายค้าง เพื่อให้ finally ปลดล็อกปุ่มได้
async function requestFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  if (response.redirected && new URL(response.url).pathname === '/login') {
    throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  }
  return response;
}

async function getData(url) {
  const response = await requestFetch(url);
  return response.json();
}

async function postData(url, body) {
  const response = await requestFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  data.httpStatus = response.status;
  return data;
}

function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {}
}
const dialogFocus = {};

function toggleOrderDropdown(orderId, customer = false) {
  const dropdown = byId((customer ? 'cust-dropdown-' : 'dropdown-') + orderId);
  if (dropdown) {
    setOrderDropdown(dropdown.id, !dropdown.classList.contains('open'));
  }
}

function setOrderDropdown(id, open) {
  const dropdown = byId(id);
  const buttonId = id.startsWith('cust-')
    ? id.replace('cust-dropdown-', 'cust-btn-')
    : id.replace('dropdown-', 'toggle-btn-');
  const button = byId(buttonId);
  if (!dropdown) {
    return;
  }
  dropdown.classList.toggle('open', open);
  if (!button) {
    return;
  }
  button.classList.toggle('collapsed', !open);
  const label = button.querySelector('.toggle-text');
  if (label) {
    label.textContent = open ? 'ซ่อนรายการ' : 'ดูรายการ';
  }
}

async function sendStaffAction(url, body, refresh) {
  if (window.staffSending) {
    return;
  }
  window.staffSending = true;
  const controls = [...document.querySelectorAll('.container button')].map((el) => [
    el,
    el.disabled
  ]);
  controls.forEach(([el]) => (el.disabled = true));
  try {
    const data = await postData(url, body);
    if (!data.success) {
      throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
    }
  } catch (err) {
    alert(
      ['TimeoutError', 'TypeError'].includes(err.name)
        ? 'ยังไม่ได้รับคำตอบ กรุณาดูสถานะล่าสุดก่อนลองอีกครั้ง'
        : err.message
    );
  } finally {
    window.staffSending = false;
    controls.forEach(([el, disabled]) => (el.disabled = disabled));
    refresh();
  }
}

function dialogOpen(id, state = 'active') {
  const dialog = byId(id);
  dialogFocus[id] = document.activeElement;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-hidden', 'false');
  const title = dialog.querySelector('h2,h3');
  if (title) {
    if (!title.id) {
      title.id = id + 'Title';
    }
    dialog.setAttribute('aria-labelledby', title.id);
  }
  dialog.classList.add(state);
  dialog.tabIndex = -1;
  const target =
    dialog.querySelector('[data-dialog-focus]') ||
    dialog.querySelector(
      'input:not([type=hidden]):not(:disabled),select:not(:disabled),button:not(:disabled),a[href]'
    ) ||
    dialog;
  target.focus();
}

function dialogClose(id, state = 'active') {
  const dialog = byId(id);
  const previous = dialogFocus[id];
  if (previous?.isConnected) {
    previous.focus();
  }
  dialog.classList.remove(state);
  dialog.setAttribute('aria-hidden', 'true');
  delete dialogFocus[id];
}

function closeActiveDialog(dialog) {
  if (
    window.orderSending ||
    window.printingDocument ||
    dialog.querySelector('button[type=submit]:disabled')
  ) {
    return;
  }
  if (dialog.classList.contains('sheet')) {
    closeSheets();
  } else {
    closeModal(dialog.id);
  }
}
document.addEventListener('keydown', (event) => {
  const dialog = document.querySelector('.modal-overlay.active,.sheet.open');
  if (!dialog) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeActiveDialog(dialog);
  }
  if (event.key !== 'Tab') {
    return;
  }
  const controls = [
    ...dialog.querySelectorAll('button,input,select,a[href],[tabindex="0"]')
  ].filter((el) => !el.disabled && el.offsetParent !== null);
  const first = controls[0],
    last = controls[controls.length - 1];
  let target;
  if (!first) {
    target = dialog;
  } else if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === dialog)
  ) {
    target = last;
  } else if (!event.shiftKey && document.activeElement === last) {
    target = first;
  }
  if (target) {
    event.preventDefault();
    target.focus();
  }
});
document.addEventListener('click', (event) => {
  if (event.target.matches('.modal-overlay.active')) {
    closeActiveDialog(event.target);
  }
});
document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('.modal-overlay,.sheet')
    .forEach((el) => el.setAttribute('aria-hidden', 'true'));
});
