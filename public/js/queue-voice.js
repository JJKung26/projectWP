// ประกอบไฟล์เสียงเพื่อประกาศเลขคิวภาษาไทย
// เล่นเสียงตามลำดับ: เสียงเตือน คิวหมายเลข ตัวเลข และเชิญเข้าร้าน
const queueAudio = new Audio('/audio/queue/chime.wav');
let soundReady = false;
let queueVoiceRun = 0;

// เปิดสิทธิ์เล่นเสียงเมื่อพนักงานกดเรียกคิวครั้งแรก
async function enableSound() {
  if (soundReady) return;
  try {
    // เปิดเสียงครั้งแรกตอนกดปุ่ม เพื่อให้เบราว์เซอร์อนุญาตให้เล่นเสียง
    queueAudio.volume = 0;
    await queueAudio.play();
    queueAudio.pause();
    soundReady = true;
  } catch {
    byId('queueNotice').textContent = 'เปิดเสียงไม่ได้ กรุณาดูเลขคิวบนหน้าจอ';
  } finally {
    queueAudio.volume = 1;
  }
}

// เล่นเสียงเตือน เลขคิว และข้อความเชิญตามลำดับ
function announceQueue(queueNo) {
  const run = ++queueVoiceRun;
  const notice = byId('queueNotice');
  const number = String(queueNo).replace(/^Q/i, '');
  const clips = ['chime', 'intro', ...number, 'outro'];
  let index = 0;
  queueAudio.pause();
  notice.textContent = 'กำลังประกาศคิว ' + queueNo;

  // แจ้งเลขคิวบนจอเมื่อเล่นเสียงไม่สำเร็จ
  function failed() {
    if (run !== queueVoiceRun) return;
    queueAudio.pause();
    notice.textContent = 'เรียกคิว ' + queueNo + ' แล้ว · เล่นเสียงไม่ได้ กรุณาดูเลขคิวบนจอ';
  }
  // เล่นไฟล์เสียงถัดไปจนจบคำประกาศ
  function playNext() {
    if (run !== queueVoiceRun) return;
    if (index === clips.length) {
      notice.textContent = 'ประกาศคิว ' + queueNo + ' แล้ว';
      return;
    }
    queueAudio.src = '/audio/queue/' + clips[index++] + '.wav';
    queueAudio.onended = playNext;
    queueAudio.onerror = failed;
    queueAudio.play().catch(failed);
  }
  playNext();
}
