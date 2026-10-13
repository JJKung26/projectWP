// ตรวจรหัส จำนวน และยอดเงินก่อนใช้ข้อมูล
// หยุดทำรายการและแจ้งข้อความเมื่อเงื่อนไขไม่ผ่าน
function check(ok, status, message) {
  if (ok) return;
  const error = new Error(message);
  error.status = status;
  throw error;
}

// ตรวจว่ารหัสเป็นข้อความที่มีความยาวถูกต้อง
function id(value, label = 'รหัส') {
  const valid = typeof value === 'string' && value.length > 0 && value.length <= 100;
  check(valid, 400, label + 'ไม่ถูกต้อง');
  return value;
}

// ตรวจจำนวนเต็มให้อยู่ในช่วงที่กำหนด
function integer(value, max, label, min = 1) {
  const n = Number(value);
  const message = label + 'ต้องเป็นจำนวนเต็ม ' + min + '–' + max;
  check(typeof value === 'number' || typeof value === 'string', 400, message);
  check(String(value).trim() !== '' && Number.isInteger(n), 400, message);
  check(n >= min && n <= max, 400, message);
  return n;
}

// ตรวจยอดเงินและแปลงบาทเป็นสตางค์เพื่อใช้คำนวณ
function money(value, max = 1000000) {
  // คืนค่าสตางค์เป็นจำนวนเต็ม เพื่อคำนวณยอดเงินโดยไม่เสียความแม่นยำ
  check(typeof value === 'number' || typeof value === 'string', 400, 'จำนวนเงินไม่ถูกต้อง');
  const n = Number(value);
  const cents = Math.round(n * 100);
  const message = 'จำนวนเงินต้องถูกต้องและมีทศนิยมไม่เกิน 2 ตำแหน่ง';
  check(String(value).trim() !== '' && Number.isFinite(n), 400, message);
  check(n >= 0 && n <= max, 400, message);
  check(Math.abs(n * 100 - cents) < 0.00001, 400, message);
  return cents;
}

// คืนวันที่วันนี้ตามเขตเวลาไทย
function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}
module.exports = { check, id, integer, money, today };
