const TIME_ZONE = 'Asia/Bangkok';
// SQLite CURRENT_TIMESTAMP เก็บเวลา UTC โดยไม่มีเครื่องหมายเขตเวลา
const utcDate = (value) => new Date(String(value).replace(' ', 'T') + 'Z');

function thaiTime(value) {
  return utcDate(value).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE
  });
}

function thaiDate(value) {
  return value
    ? utcDate(value).toLocaleString('th-TH', { timeZone: TIME_ZONE })
    : 'ไม่พบเวลาที่บันทึก';
}
module.exports = { thaiDate, thaiTime };
