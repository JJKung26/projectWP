function check(ok, status, message) {
    if (!ok) throw Object.assign(new Error(message), { status });
}
function id(value, label = 'รหัส') {
    check(
        typeof value === 'string' && value.length > 0 && value.length <= 100,
        400,
        label + 'ไม่ถูกต้อง'
    );
    return value;
}
function integer(value, max, label, min = 1) {
    const n = Number(value);
    check(
        (typeof value === 'number' || typeof value === 'string') &&
            String(value).trim() !== '' &&
            Number.isInteger(n) &&
            n >= min &&
            n <= max,
        400,
        label + 'ต้องเป็นจำนวนเต็ม ' + min + '–' + max
    );
    return n;
}
function money(value, max = 1000000) {
    // คืนค่าสตางค์เป็นจำนวนเต็ม เพื่อคำนวณยอดเงินโดยไม่เสียความแม่นยำ
    check(typeof value === 'number' || typeof value === 'string', 400, 'จำนวนเงินไม่ถูกต้อง');
    const n = Number(value);
    check(
        String(value).trim() !== '' &&
            Number.isFinite(n) &&
            n >= 0 &&
            n <= max &&
            Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
        400,
        'จำนวนเงินต้องถูกต้องและมีทศนิยมไม่เกิน 2 ตำแหน่ง'
    );
    return Math.round(n * 100);
}
const today = () =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
module.exports = { check, id, integer, money, today };
