# ระบบร้านหมูกระทะ

ระบบโต๊ะ คิว สั่งอาหาร ครัว เสิร์ฟ ชำระเงิน และพิมพ์ใบเสร็จ

## รายชื่อสมาชิก 

นายพชร สรรพเศรษฐ 66070295
นายเอเชีย 	อ่อนพรม 66070324
นายเจมส์ อัลเฟรด เครก 68070018
นายเจษฎา สมหวังได้ 68070019

## วิธีรัน

1. ติดตั้ง [Node.js 24 x64](https://nodejs.org/en/download) บน Windows 64-bit
2. แตก ZIP แล้วเปิดโฟลเดอร์ที่มี `package.json` ใน VS Code
3. เปิด **Terminal > New Terminal** แล้วรันทีละคำสั่ง:

```powershell
npm.cmd ci
npm.cmd start
```

`npm.cmd ci` ใช้ติดตั้งแพ็กเกจครั้งแรก ครั้งถัดไปใช้แค่ `npm.cmd start`

หรือดับเบิลคลิก **START.bat** ระบบจะติดตั้งแพ็กเกจที่ขาดแล้วเปิดเว็บให้

## บัญชีเริ่มต้น

| หน้าที่ | Username | Password |

| ผู้ดูแลระบบ | `admin` | `admin123` |

| แคชเชียร์ | `cashier1`, `cashier2` | `cashier123` |

| ครัว | `kitchen1`, `kitchen2` | `kitchen123` |

| เสิร์ฟ | `service1`, `service2` | `service123` |


## ตัวอย่างหน้าใช้งาน พอร์ต 3000

- Login: `http://localhost:3000/login`
- แคชเชียร์: `http://localhost:3000/cashier/tables`
- ครัว: `http://localhost:3000/kitchen`
- เสิร์ฟ: `http://localhost:3000/serving`


## หมายเหตุ

- ต้องใช้เน็ตเพื่อติดตั้งแพ็กเกจและเชื่อม Cloudflare แม้มี `cloudflared.exe` แล้ว
- ลิงก์ Cloudflare ใช้เข้าเว็บจากเครื่องอื่นได้ และอาจเปลี่ยนเมื่อเปิดใหม่
- การเปิดเว็บซ้ำไม่ล้างข้อมูลเดิม