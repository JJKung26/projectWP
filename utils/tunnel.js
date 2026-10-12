function urlError(message) {
  const error = new Error(message);
  error.status = 503;
  error.expose = true;
  throw error;
}

function getPublicUrl(req) {
  if (process.env.PUBLIC_URL) {
    let url;
    try {
      url = new URL(process.env.PUBLIC_URL);
    } catch {
      urlError('PUBLIC_URL ไม่ใช่ URL ที่ถูกต้อง เช่น http://192.168.1.35:3000');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      urlError('PUBLIC_URL ต้องเป็น URL ที่มือถือเข้าได้ เช่น IP ของเครื่องบน Wi-Fi');
    }
    return url.origin;
  }
  if (req) {
    const host = req.hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
      return req.protocol + '://' + req.get('host');
    }
    urlError(
      'กรุณาเปิด Cloudflare ด้วย npm start หรือตั้ง PUBLIC_URL เป็น IP บน Wi-Fi ก่อนเปิดโต๊ะ'
    );
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}
module.exports = { getPublicUrl };
