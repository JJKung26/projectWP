const fs = require('fs');
const path = require('path');
const generatePayload = require('promptpay-qr');
const { check } = require('./validation');

function getNumber() {
    let number;
    try {
        number = JSON.parse(
            fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8')
        ).promptpayNumber;
    } catch {
        /* แจ้งข้อผิดพลาดเฉพาะพร้อมเพย์ เงินสดยังใช้งานได้ */
    }
    check(
        typeof number === 'string' && /^(0[689]\d{8}|\d{13})$/.test(number),
        400,
        'กรุณาตั้ง promptpayNumber ใน config.json เป็นเบอร์มือถือ 10 หลักหรือเลขผู้เสียภาษี 13 หลัก'
    );
    return number;
}

function paymentPayload(amount) {
    check(
        Number.isSafeInteger(amount) && amount > 0 && amount <= 1000000,
        400,
        'ยอดพร้อมเพย์ต้องเป็นจำนวนเต็มบาทมากกว่า 0'
    );
    const number = getNumber();
    return { number, payload: generatePayload(number, { amount }) };
}
module.exports = { getNumber, paymentPayload };
