// เปิดเอกสารใน iframe เพื่อพิมพ์เฉพาะใบเสร็จหรือใบ QR
function printDocument(id, longReceipt = false) {
  if (window.printingDocument) return;
  window.printingDocument = true;
  const source = byId(id);
  const container = source.closest('.modal-content') || document;
  const paper = container.querySelector('.paper-size:checked').value;
  const width = Number(paper) - 6;
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.style.width = width + 'mm';
  // รอฟอนต์ กำหนดขนาดกระดาษ แล้วเปิดหน้าต่างพิมพ์
  frame.onload = async function () {
    try {
      await frame.contentDocument.fonts.ready;
      // เปลี่ยนความสูงจากพิกเซลเป็นมิลลิเมตร
      let height = Math.ceil((frame.contentDocument.body.offsetHeight * 25.4) / 96) + 8;
      if (longReceipt && height > 297) height = 297;
      const style = frame.contentDocument.createElement('style');
      style.textContent = `@page{size:${paper}mm ${height}mm;margin:3mm}`;
      frame.contentDocument.head.appendChild(style);
      frame.contentWindow.onafterprint = function () {
        frame.remove();
      };
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      frame.remove();
      alert('พิมพ์ไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
    window.printingDocument = false;
  };
  // ใส่เฉพาะใบที่จะพิมพ์กับ CSS ลงใน iframe
  frame.srcdoc = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <title>เอกสารร้านหมูกระทะ</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/print.css">
    <style>:root{--paper-width:${width}mm}</style>
    </head><body class="print-document">${source.outerHTML}</body></html>`;
  document.body.appendChild(frame);
}
