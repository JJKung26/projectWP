const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

function validateSecret(secret, source) {
  if (typeof secret !== 'string' || secret.length < 32 || secret === 'moo-krata-dev-secret-2026') {
    throw new Error(`${source}: ค่าลับสำหรับล็อกอินต้องมีอย่างน้อย 32 ตัวอักษร`);
  }
  return secret;
}

// เก็บกุญแจข้างฐานข้อมูล เพื่อให้ cookie ยังใช้ได้หลังเปิดโปรแกรมใหม่
function getSessionSecret(secretPath) {
  if (process.env.SESSION_SECRET !== undefined) {
    return validateSecret(process.env.SESSION_SECRET, 'SESSION_SECRET');
  }
  const databasePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db');
  const file =
    secretPath || path.join(path.dirname(path.resolve(databasePath)), 'session-secret.key');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
  return validateSecret(fs.readFileSync(file, 'utf8').trim(), file);
}
module.exports = { getSessionSecret };
