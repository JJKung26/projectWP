const TIME_ZONE = 'Asia/Bangkok';
// SQLite CURRENT_TIMESTAMP เก็บเวลา UTC โดยไม่มีเครื่องหมายเขตเวลา
function utcDate(value) {
  if (value instanceof Date) return value;
  return new Date(value.replace(' ', 'T') + 'Z');
}

// แสดงเฉพาะชั่วโมงและนาทีตามเวลาไทย
function thaiTime(value) {
  return utcDate(value).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE
  });
}

// แสดงวันและเวลาตามเวลาไทย
function thaiDate(value) {
  return utcDate(value).toLocaleString('th-TH', { timeZone: TIME_ZONE });
}
// แสดงเฉพาะวันที่ตามเวลาไทย สำหรับใบ QR
function thaiDay(value) {
  return utcDate(value).toLocaleDateString('th-TH', { timeZone: TIME_ZONE });
}
module.exports = { thaiDate, thaiTime, thaiDay };
