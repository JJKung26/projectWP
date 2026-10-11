// พิมพ์สำเนาเอกสารเดียวใน iframe เพื่อไม่ให้ modal หรือผังโต๊ะติดไปด้วย
async function printDocument(id, longReceipt = false) {
    const source = document.getElementById(id);
    if (!source || window.printingDocument) return;
    window.printingDocument = true;
    let frame;
    try {
        const paper = source.closest('.modal-content')?.querySelector('.paper-size:checked')?.value || document.querySelector('.paper-size:checked')?.value || '80';
        const width = (Number(paper)-6)+'mm';
        frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;left:-10000px;width:'+((Number(paper)-6)*96/25.4)+'px;height:1000px;border:0';
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        doc.open();
        doc.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>เอกสารร้านหมูกระทะ</title><link rel="stylesheet" href="/css/style.css"></head><body></body></html>');
        doc.close();
        const clone = source.cloneNode(true);
        clone.removeAttribute('id');
        clone.classList.remove('print-target');
        doc.body.appendChild(clone);
        const style = doc.createElement('style');
        style.textContent = '@page{margin:3mm} html,body{width:'+width+';height:auto!important;min-height:0!important} body{margin:0;background:white;font:12px Tahoma,sans-serif;print-color-adjust:exact} body *{visibility:visible!important} .receipt-slip{position:static!important;width:'+width+'!important;max-width:100%!important;padding:3mm!important;margin:0 auto!important;border:0!important;box-shadow:none!important;break-inside:'+(longReceipt?'auto':'avoid')+'} .slip-header h1{font-size:20px}.slip-header h2{font-size:16px}.slip-qr-img{width:40mm;height:40mm} .slip-row{flex-wrap:wrap} .slip-row span,.slip-url,p{overflow-wrap:anywhere} tr,.slip-header{break-inside:avoid;page-break-inside:avoid} table{width:100%;table-layout:fixed} th,td{padding:6px 2px!important;overflow-wrap:anywhere} thead{display:table-header-group}';
        if (source.classList.contains('order-slip')) {
            style.textContent += ' .order-slip .slip-qr-img{width:40mm;height:40mm} .order-slip .order-slip-table{font-size:18px} .order-slip .order-slip-time{font-size:18px} .order-slip .order-slip-meta{font-size:9px}';
        }
        if (source.classList.contains('payment-receipt')) {
            style.textContent += ' .payment-receipt{padding:0!important;font-size:11px}.payment-receipt h1{font-size:14px}.payment-receipt h2{font-size:18px}.receipt-logo{width:52px;height:52px;margin-bottom:10px}.receipt-dining p{font-size:13px}.receipt-grand-total{font-size:15px}.receipt-meta,.receipt-footer{font-size:9px}.receipt-items th,.receipt-items td{padding:4px 0!important}';
        }
        doc.head.appendChild(style);
        const sheet = doc.querySelector('link');
        const styleReady = new Promise((resolve,reject) => {
            if (sheet.sheet) return resolve();
            sheet.onload=resolve; sheet.onerror=()=>reject(new Error('โหลดรูปแบบเอกสารไม่สำเร็จ'));
            setTimeout(() => { if (sheet.sheet) resolve(); else reject(new Error('โหลดรูปแบบเอกสารไม่ทัน กรุณาลองอีกครั้ง')); }, 10000);
        });
        await Promise.all([styleReady, ...[...doc.images].map(img => img.decode())]);
        await Promise.race([doc.fonts.ready,new Promise(resolve=>setTimeout(resolve,2000))]);
        await new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
        // กระดาษม้วนยาวตามเนื้อหา หลังโหลดรูปและฟอนต์แล้ว เผื่อขอบบน/ล่าง 6 มม. + 2 มม.
        const height = Math.ceil(clone.getBoundingClientRect().height * 25.4 / 96) + 8;
        const pageHeight = longReceipt ? Math.min(height, 297) : height;
        style.sheet.insertRule('@page{size:'+paper+'mm '+pageHeight+'mm;margin:3mm}', style.sheet.cssRules.length);
        frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once:true });
        setTimeout(() => frame.remove(), 60000);
        frame.contentWindow.focus();
        frame.contentWindow.print();
    } catch (err) { if (frame) frame.remove(); alert('พิมพ์ไม่สำเร็จ: ' + err.message); }
    finally { window.printingDocument = false; }
}
