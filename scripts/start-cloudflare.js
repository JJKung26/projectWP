// เลือกพอร์ตเว็บก่อน แล้วเปิด Cloudflare สำหรับแชร์ QR
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const binary = path.join(__dirname, '../tools/cloudflared.exe');
const port = process.env.PORT || 3000;
let cloud;
let server;

// ดาวน์โหลด Cloudflare ถ้ายังไม่มี แล้วเปิดเว็บเพื่อเลือกพอร์ต
async function start() {
  if (!fs.existsSync(binary)) {
    console.log('Downloading Cloudflare...');
    const response = await fetch(
      'https://github.com/cloudflare/cloudflared/releases/latest/download/' +
        'cloudflared-windows-amd64.exe'
    );
    if (!response.ok) throw Error('ดาวน์โหลด Cloudflare ไม่สำเร็จ');
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(binary, Buffer.from(await response.arrayBuffer()));
  }
  server = require('../server').start(port, startTunnel);
}
// เปิด tunnel ไปยังพอร์ตที่เว็บใช้จริง
function startTunnel(actualPort) {
  cloud = spawn(
    binary,
    ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:' + actualPort],
    { windowsHide: true }
  );
  let output = '';
  // อ่าน URL ที่ Cloudflare ส่งมา แล้วใช้สร้าง QR และแสดงลิงก์
  cloud.stderr.on('data', function (data) {
    output += data;
    const url = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (url && process.env.PUBLIC_URL !== url[0]) {
      process.env.PUBLIC_URL = url[0];
      console.log('Web Local: http://localhost:' + actualPort);
      console.log('Web Public: ' + url[0]);
    }
  });
  cloud.on('error', fail);
  cloud.once('exit', stop);
}
// ปิดเว็บและ Cloudflare เมื่อจบการทำงาน
function stop() {
  if (cloud) cloud.kill();
  if (server) {
    server.close();
    server.closeAllConnections();
  }
}
// แสดงข้อผิดพลาดและปิดโปรแกรมที่เปิดไว้
function fail(error) {
  console.error(error.message);
  process.exitCode = 1;
  stop();
}
// รับคำสั่งหยุดจากผู้ใช้ และเริ่มโปรแกรม
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', function () {
  if (cloud) cloud.kill();
});
start().catch(fail);
