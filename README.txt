ระบบร้านหมูกระทะ

สมาชิกกลุ่ม
1. นายพชร สรรพเศรษฐ 66070295
2. นายเอเชีย อ่อนพรม 66070324
3. นายเจมส์ อัลเฟรด เครก 68070018
4. นายเจษฎา สมหวังได้ 68070019

ต้องมี Node.js 24 ขึ้นไป สำหรับ START.bat และ Cloudflare ใช้ Windows 64-bit

ขั้นตอนการใช้งานเว็บ

1. เปิด PowerShell ในโฟลเดอร์ที่มี package.json
2. ติดตั้งแพ็กเกจครั้งแรก: npm.cmd ci
3. เปิดเว็บ: npm.cmd start
4. เข้า URL หลังคำว่า Web ที่โปรแกรมแสดง เช่น http://localhost:3000
5. QR และลิงก์public จะใช้ https://...trycloudflare.com ที่โปรแกรมแสดง
ต้องใช้อินเทอร์เน็ต และเปิดโปรแกรมไว้ระหว่างใช้งาน

บัญชีเริ่มต้น (Username / Password)
ผู้ดูแลระบบ: admin / admin123
แคชเชียร์: cashier1 หรือ cashier2 / cashier123
ครัว: kitchen1 หรือ kitchen2 / kitchen123
เสิร์ฟ: service1 หรือ service2 / service123