// เลือกพอร์ตว่าง เปิด Cloudflare แล้วเปิดเว็บร้าน
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const binary = path.join(root, 'tools', 'cloudflared.exe');
let port = Number(process.env.PORT || 3000);
let cloud, web, timeout;
let stopping = false;

// หยุดเว็บและ Cloudflare เมื่อปิดโปรแกรม
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timeout);
  cloud?.kill();
  web?.server.close();
  web?.server.closeAllConnections();
  process.exitCode = code;
}
// แสดงข้อผิดพลาดแล้วหยุดการเปิดระบบ
function fail(error) {
  console.error(error.message);
  stop(1);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('exit', () => cloud?.kill());

// ตรวจว่าพอร์ตที่เลือกมีโปรแกรมอื่นใช้อยู่หรือไม่
function portInUse(number) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(true);
      else reject(error);
    });
    probe.listen(number, '0.0.0.0', () => probe.close(() => resolve(false)));
  });
}

// ดาวน์โหลด cloudflared เมื่อยังไม่มีไฟล์ในเครื่อง
async function downloadCloudflare() {
  if (fs.existsSync(binary)) return;
  console.log('Downloading cloudflared...');
  const response = await fetch(
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
    { signal: AbortSignal.timeout(120000) }
  );
  if (!response.ok) throw Error('cloudflared download failed: HTTP ' + response.status);
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary + '.download', Buffer.from(await response.arrayBuffer()));
  fs.renameSync(binary + '.download', binary);
}

// เชื่อม Cloudflare เพื่อรับลิงก์สาธารณะ
function startTunnel() {
  return new Promise(function (resolve, reject) {
    cloud = spawn(
      binary,
      ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`],
      { cwd: root, windowsHide: true }
    );
    timeout = setTimeout(
      () => reject(Error('Cloudflare connection timed out. Please try again.')),
      60000
    );
    let output = '';
    // อ่านผลจาก Cloudflare เพื่อหาลิงก์เว็บ
    function read(data) {
      process.stderr.write(data);
      output = (output + data).slice(-8192);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (!match || stopping) return;
      clearTimeout(timeout);
      resolve(match[0]);
    }
    cloud.stdout.on('data', read);
    cloud.stderr.on('data', read);
    cloud.on('error', reject);
    cloud.on('exit', (code) => {
      if (!stopping) console.error('Cloudflare stopped; stopping the website too.');
      stop(code || 1);
    });
  });
}
// ตรวจเครื่อง เลือกพอร์ต แล้วเริ่มเว็บพร้อมลิงก์ Cloudflare
async function start() {
  if (
    process.platform !== 'win32' ||
    process.arch !== 'x64' ||
    process.versions.node.split('.')[0] !== '24'
  ) {
    throw Error('Install Node.js 24 for Windows x64: https://nodejs.org/en/download');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error('PORT must be between 1 and 65535.');
  // กด START ซ้ำให้เปิดเว็บเดิม; ถ้าเป็นโปรแกรมอื่นให้ใช้พอร์ตถัดไป
  const script = fs.readFileSync(path.join(root, 'public/js/ui.js'), 'utf8');
  while (await portInUse(port)) {
    const url = `http://localhost:${port}`;
    try {
      const response = await fetch(url + '/js/ui.js', { signal: AbortSignal.timeout(5000) });
      if (response.ok && (await response.text()) === script) {
        console.log('Website is already running:', url + '/cashier/tables');
        spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url + '/cashier/tables'], {
          windowsHide: true,
          stdio: 'ignore'
        }).on('error', console.error);
        return;
      }
    } catch {}
    console.log(`Port ${port} is in use. Trying port ${port + 1}...`);
    port++;
    if (port > 65535) throw Error('No available port.');
  }
  // ดาวน์โหลดตัวเปิด Cloudflare แล้วเริ่มเว็บด้วย URL ที่ได้รับ
  await downloadCloudflare();
  if (stopping) return;
  const publicUrl = await startTunnel();
  if (stopping) return;
  process.env.PORT = String(port);
  process.env.PUBLIC_URL = publicUrl;
  console.log('\nCloudflare URL:', publicUrl);
  web = require('../server');
  await web.start(port);
}
start().catch(fail);
