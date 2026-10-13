// แปลงเวลาที่บันทึกไว้ให้แสดงตามเวลาไทย
const TIME_ZONE = 'Asia/Bangkok';
// SQLite CURRENT_TIMESTAMP เก็บเวลา UTC โดยไม่มีเครื่องหมายเขตเวลา
function utcDate(value) {
  return new Date(String(value).replace(' ', 'T') + 'Z');
}

// แสดงเฉพาะชั่วโมงและนาทีตามเวลาไทย
function thaiTime(value) {
  return utcDate(value).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE
  });
}

// แสดงวันและเวลาตามเวลาไทย
function thaiDate(value) {
  if (!value) return 'ไม่พบเวลาที่บันทึก';
  return utcDate(value).toLocaleString('th-TH', { timeZone: TIME_ZONE });
}
module.exports = { thaiDate, thaiTime };
