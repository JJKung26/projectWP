// สร้างข้อผิดพลาดพร้อมรหัสสถานะ ให้ middleware ส่งข้อความกลับ
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

// ตรวจจำนวนเต็มและช่วงที่ใช้ เช่น จำนวนคนหรืออาหาร
function integer(value, max, label, min = 1) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) fail(label + 'ไม่ถูกต้อง');
  return number;
}

// คิดเงินเป็นสตางค์ เพื่อให้คำนวณทศนิยมได้ตรง
function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) fail('จำนวนเงินไม่ถูกต้อง');
  return Math.round(number * 100);
}

// อ่านวันที่วันนี้ตามเวลาไทย สำหรับเลขคิวประจำวัน
function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}
module.exports = { fail, integer, money, today };
