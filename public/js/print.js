// เตรียมสำเนาใบ QR บัตรคิว หรือใบเสร็จสำหรับพิมพ์
// พิมพ์สำเนาเอกสารเดียวใน iframe เพื่อไม่ให้ modal หรือผังโต๊ะติดไปด้วย
async function printDocument(id, longReceipt = false) {
  const source = document.getElementById(id);
  if (!source || window.printingDocument) return;
  window.printingDocument = true;
  let frame;
  try {
    const paper =
      source.closest('.modal-content')?.querySelector('.paper-size:checked')?.value ||
      document.querySelector('.paper-size:checked')?.value ||
      '80';
    const width = Number(paper) - 6 + 'mm';
    frame = document.createElement('iframe');
    frame.style.cssText = `position:fixed;left:-10000px;width:${((Number(paper) - 6) * 96) / 25.4}px;height:1000px;border:0`;
    // load รอทั้งรูปและ CSS ของเอกสาร จึงไม่ต้องเขียนตัวรอแยกทีละไฟล์
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('โหลดเอกสารไม่ทัน กรุณาลองอีกครั้ง')), 10000);
      frame.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      frame.srcdoc = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>เอกสารร้านหมูกระทะ</title>
        <link rel="stylesheet" href="/css/base/foundation.css"><link rel="stylesheet" href="/css/components/layout.css">
        <link rel="stylesheet" href="/css/cashier/slips.css"><link rel="stylesheet" href="/css/base/document.css">
        </head><body>${source.outerHTML}</body></html>`;
      document.body.appendChild(frame);
    });
    const doc = frame.contentDocument;
    const clone = doc.getElementById(id);
    clone.removeAttribute('id');
    clone.classList.remove('print-target');
    doc.documentElement.style.setProperty('--paper-width', width);
    clone.style.breakInside = longReceipt ? 'auto' : 'avoid';
    for (const link of doc.querySelectorAll('link')) {
      if (!link.sheet || link.sheet.cssRules.length === 0) throw Error('โหลดรูปแบบเอกสารไม่สำเร็จ');
    }
    for (const image of doc.images) {
      if (!image.naturalWidth) throw Error('โหลดรูปเอกสารไม่สำเร็จ');
    }
    await doc.fonts.ready;
    // กระดาษม้วนยาวตามเนื้อหา หลังโหลดรูปและฟอนต์แล้ว เผื่อขอบบน/ล่าง 6 มม. + 2 มม.
    const height = Math.ceil((clone.getBoundingClientRect().height * 25.4) / 96) + 8;
    const pageHeight = longReceipt ? Math.min(height, 297) : height;
    const page = doc.createElement('style');
    page.textContent = `@page{size:${paper}mm ${pageHeight}mm;margin:3mm}`;
    doc.head.appendChild(page);
    frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
    setTimeout(() => frame.remove(), 60000);
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } catch (err) {
    if (frame) frame.remove();
    alert('พิมพ์ไม่สำเร็จ: ' + err.message);
  } finally {
    window.printingDocument = false;
  }
}
