# เสียงเรียกคิว

ไฟล์เสียงภาษาไทยผู้หญิง `th-TH-PremwadeeNeural` ของ Microsoft สร้างด้วย edge-tts ความเร็ว -5% แล้วตัดช่วงเงียบหัวท้าย เป็น WAV mono 24 kHz

- `intro.wav`: ขอเชิญลูกค้าคิวหมายเลข
- `outro.wav`: ติดต่อพนักงานด้วยค่ะ
- `0.wav` ถึง `9.wav`: ศูนย์ ถึง เก้า

เว็บเล่นไฟล์เหล่านี้โดยตรง ไม่ต้องมี Python หรือเรียกบริการเสียงภายนอกขณะใช้งาน สร้างใหม่ด้วย `scripts/generate-queue-voice.py` ส่วนคำสั่งติดตั้งอยู่ต้นไฟล์สคริปต์

แหล่งอ้างอิงเสียง: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
เครื่องมือสร้าง: https://github.com/rany2/edge-tts
