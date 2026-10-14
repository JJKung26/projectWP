// เตรียมเครื่องเล่นเสียงและจำว่าเบราว์เซอร์อนุญาตเสียงแล้วหรือยัง
const queueAudio = new Audio('/audio/queue/chime.wav');
let soundReady = false;

// เปิดสิทธิ์เล่นเสียงจากการกดปุ่มของผู้ใช้
async function enableSound() {
  if (soundReady) return;
  try {
    queueAudio.volume = 0;
    await queueAudio.play();
    queueAudio.pause();
    soundReady = true;
  } catch {
    byId('queueNotice').textContent = 'เปิดเสียงไม่ได้ กรุณาดูเลขคิวบนหน้าจอ';
  }
  queueAudio.volume = 1;
}

// เรียงเสียงเริ่มต้น ตัวเลขคิว และเสียงปิดท้าย
function announceQueue(number) {
  const clips = ['chime', 'intro'];
  for (const digit of number.slice(1)) clips.push(digit);
  clips.push('outro');
  let index = 0;
  queueAudio.pause();
  byId('queueNotice').textContent = 'เรียกคิว ' + number;
  // เล่นทีละไฟล์ แล้วเล่นไฟล์ถัดไปเมื่อเสียงเดิมจบ
  function playNext() {
    if (index === clips.length) return;
    queueAudio.src = '/audio/queue/' + clips[index] + '.wav';
    index++;
    queueAudio.play().catch(function () {
      byId('queueNotice').textContent = 'เรียกคิว ' + number + ' แล้ว แต่เล่นเสียงไม่ได้';
    });
  }
  queueAudio.onended = playNext;
  playNext();
}
