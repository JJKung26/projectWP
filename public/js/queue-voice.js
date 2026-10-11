// เสียงผู้หญิงภาษาไทยจากไฟล์ในโปรเจกต์ ต่อเลขทีละหลักเพื่อเก็บเลขศูนย์นำหน้า
let queueAudio,
    queueClips,
    queueVoiceRun = 0,
    queueVoiceSources = [];

async function enableSound() {
    try {
        queueAudio ||= new (window.AudioContext || window.webkitAudioContext)();
        await queueAudio.resume();
    } catch {
        document.getElementById('queueNotice').textContent =
            'เปิดเสียงไม่ได้ กรุณาดูเลขคิวบนหน้าจอ';
    }
}

function playChime() {
    if (!queueAudio || queueAudio.state !== 'running') return;
    const tone = queueAudio.createOscillator(),
        gain = queueAudio.createGain();
    tone.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, queueAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, queueAudio.currentTime + 0.4);
    tone.connect(gain);
    gain.connect(queueAudio.destination);
    tone.start();
    tone.stop(queueAudio.currentTime + 0.4);
}

function loadQueueClips() {
    // โหลดและถอดรหัสครั้งเดียว ใช้ซ้ำได้กับทุกหมายเลขคิว
    queueClips ||= Promise.all(
        ['intro', 'outro', ...'0123456789'].map(async name => {
            const response = await requestFetch('/audio/queue/' + name + '.wav');
            if (!response.ok) throw new Error('โหลดเสียงไม่ได้');
            return [name, await queueAudio.decodeAudioData(await response.arrayBuffer())];
        })
    ).then(clips => Object.fromEntries(clips));
    return queueClips;
}

async function announceQueue(queueNo) {
    const run = ++queueVoiceRun;
    queueVoiceSources.forEach(source => {
        try {
            source.stop();
        } catch {}
    });
    queueVoiceSources = [];
    const notice = document.getElementById('queueNotice');
    try {
        if (!queueAudio) throw new Error('ยังไม่เปิดเสียง');
        await queueAudio.resume();
        if (run !== queueVoiceRun) return;
        playChime();
        const clips = await loadQueueClips();
        if (run !== queueVoiceRun) return;
        const names = ['intro', ...String(queueNo).replace(/^Q/i, '').split(''), 'outro'];
        let start = queueAudio.currentTime + 0.45;
        for (const name of names) {
            const source = queueAudio.createBufferSource();
            source.buffer = clips[name];
            source.connect(queueAudio.destination);
            queueVoiceSources.push(source);
            source.start(start);
            start += source.buffer.duration + 0.1;
        }
        notice.textContent = 'กำลังประกาศคิว ' + queueNo;
        queueVoiceSources.at(-1).onended = () => {
            if (run !== queueVoiceRun) return;
            notice.textContent = 'ประกาศคิว ' + queueNo + ' แล้ว';
            queueVoiceSources = [];
        };
    } catch {
        if (run !== queueVoiceRun) return;
        queueClips = null; // ให้ลองโหลดใหม่เมื่อกดเรียกคิวอีกครั้ง
        queueVoiceSources.forEach(source => {
            try {
                source.stop();
            } catch {}
        });
        queueVoiceSources = [];
        notice.textContent = 'เรียกคิว ' + queueNo + ' แล้ว · เล่นเสียงไม่ได้ กรุณาดูเลขคิวบนจอ';
    }
}
