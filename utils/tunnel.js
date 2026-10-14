// ใช้ URL ของ Cloudflare หรือ URL ที่เปิดเว็บอยู่
function getPublicUrl(req) {
  return (process.env.PUBLIC_URL || req.protocol + '://' + req.get('host')).replace(/\/$/, '');
}
module.exports = { getPublicUrl };
