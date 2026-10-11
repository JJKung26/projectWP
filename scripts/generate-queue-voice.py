"""สร้างไฟล์เสียงผู้หญิงครั้งเดียว เว็บใช้งานจากไฟล์โดยไม่ต้องติดตั้ง Python
ติดตั้งเครื่องมือเมื่อต้องการสร้างเสียงใหม่: pip install edge-tts imageio-ffmpeg
"""
import asyncio
from pathlib import Path
import subprocess
import tempfile
import wave

import edge_tts
import imageio_ffmpeg

OUTPUT = Path(__file__).resolve().parents[1] / "public/audio/queue"
PHRASES = {"intro": "ขอเชิญลูกค้าคิวหมายเลข", "outro": "ติดต่อพนักงานด้วยค่ะ"}
PHRASES.update(dict(zip(map(str, range(10)), ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"])))


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="queue-voice-") as temporary:
        for name, text in PHRASES.items():
            mp3 = Path(temporary) / (name + ".mp3")
            await edge_tts.Communicate(text, "th-TH-PremwadeeNeural", rate="-5%").save(str(mp3))
            # ตัดช่องว่างเฉพาะหัว/ท้าย เพื่อให้คำที่ต่อกันไม่เว้นนานเกินไป
            trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(mp3), "-af", trim,
                            "-ar", "24000", "-ac", "1", str(OUTPUT / (name + ".wav"))], check=True)
            print("Created voice:", name, flush=True)

    # ตัวอย่าง Q001 ต่อจากไฟล์เดียวกับที่เว็บใช้
    with wave.open(str(OUTPUT.parents[2] / "queue-female-voice-demo.wav"), "wb") as demo:
        demo.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        for name in ["intro", "0", "0", "1", "outro"]:
            with wave.open(str(OUTPUT / (name + ".wav")), "rb") as clip:
                demo.writeframes(clip.readframes(clip.getnframes()))
            demo.writeframes(bytes(2400 * 2))


if __name__ == "__main__":
    asyncio.run(main())
