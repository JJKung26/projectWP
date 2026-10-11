const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const port = Number(process.env.PORT || 3000);
const binary = path.join(root, 'tools', 'cloudflared.exe');
let cloud, web, timeout, stopping = false;

function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    clearTimeout(timeout);
    cloud?.kill();
    web?.kill();
    process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('exit', () => { cloud?.kill(); web?.kill(); });

async function start() {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Cloudflare launcher requires Windows 64-bit.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be between 1 and 65535.');
    // ตรวจพอร์ตก่อนเปิด tunnel เพื่อไม่รันทับเว็บที่ใช้งานอยู่
    await new Promise((resolve, reject) => {
        const check = net.createServer();
        check.once('error', () => reject(Error(`Port ${port} is in use. Stop the current server before starting Cloudflare.`)));
        check.listen(port, '0.0.0.0', () => check.close(resolve));
    });
    if (!fs.existsSync(binary)) {
        console.log('Downloading cloudflared from the official Cloudflare release...');
        const response = await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe', { signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw Error(`cloudflared download failed: HTTP ${response.status}`);
        fs.mkdirSync(path.dirname(binary), { recursive: true });
        fs.writeFileSync(binary + '.download', Buffer.from(await response.arrayBuffer()));
        fs.renameSync(binary + '.download', binary);
    }
    if (stopping) return;
    cloud = spawn(binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`], { cwd: root, windowsHide: true });
    timeout = setTimeout(() => { console.error('Cloudflare connection timed out. Please try again.'); stop(1); }, 60000);
    let output = '';
    const read = data => {
        process.stderr.write(data);
        output = (output + data).slice(-8192);
        const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (!match || web || stopping) return;
        clearTimeout(timeout);
        const url = match[0];
        console.log(`\nCloudflare URL: ${url}\nLocal cashier: http://localhost:${port}/cashier/tables\n`);
        // ส่ง URL ของ Cloudflare ให้เว็บและ QR เฉพาะรอบที่เปิดนี้
        web = spawn(process.execPath, ['server.js'], {
            cwd: root, windowsHide: true, stdio: 'inherit',
            env: { ...process.env, PUBLIC_URL: url }
        });
        web.on('error', err => { console.error(err.message); stop(1); });
        web.on('exit', code => stop(code ?? 1));
    };
    cloud.stdout.on('data', read);
    cloud.stderr.on('data', read);
    cloud.on('error', err => { console.error(err.message); stop(1); });
    cloud.on('exit', code => { if (!stopping) console.error('Cloudflare stopped; stopping the web server too.'); stop(code || 1); });
}
start().catch(err => { console.error(err.message); stop(1); });
