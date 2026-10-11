const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ejs = require('ejs');

const beer = quantity => ({menu_item_id:'beer',item_name:'เบียร์ลีโอ (ขวดใหญ่)',charge_type:'ALACARTE',unit_price_at_order:85,quantity});
const render = (items, extra = {}) => ejs.renderFile(path.join(__dirname,'../views/partials/receipt.ejs'), {
    session:{session_id:'test-session',guest_count:2,buffet_price:279,table_no:4,started_at:'2026-10-11'},
    items,paid:false,subtotal:898,taxAmount:62.86,beforeRounding:960.86,roundingAmount:-0.86,netAmount:960,alacarteTotal:340,
    thaiDate:value=>value,...extra
});
const itemRows = html => html.match(/<tr><td>[\s\S]*?<\/tr>/g) || [];

test('check bill merges repeated menu orders and preserves original orders and totals', async () => {
    const items = [beer(1),beer(3)];
    const original = JSON.stringify(items);
    const html = await render(items);
    const rows = itemRows(html).filter(row=>row.includes('เบียร์ลีโอ'));
    assert.equal(rows.length,1);
    assert.match(rows[0],/85\.00 บาท\/หน่วย/);
    assert.match(rows[0],/<td class="r">4<\/td><td class="r">340\.00<\/td>/);
    assert.match(html,/<span>898\.00<\/span>/);
    assert.match(html,/<span>62\.86<\/span>/);
    assert.match(html,/<strong>960\.00<\/strong>/);
    assert.equal(JSON.stringify(items),original);
});

test('different prices, menu identities and buffet charges remain separate', async () => {
    const html = await render([beer(1),{...beer(2),unit_price_at_order:90},
        {...beer(3),menu_item_id:'other-beer'},{...beer(4),charge_type:'BUFFET'}]);
    const rows = itemRows(html).filter(row=>row.includes('เบียร์ลีโอ'));
    assert.equal(rows.length,4);
    for (const amount of ['85.00','180.00','255.00','0.00']) {
        assert.ok(rows.some(row=>row.endsWith(`<td class="r">${amount}</td></tr>`)));
    }
});

test('paid receipt keeps only the extra charge summary without food names', async () => {
    const html = await render([beer(1),beer(3)], {paid:true,bill:{receipt_no:'R-test'},
        payment:{payment_method:'CASH',received_by:'cashier',paid_at:'2026-10-11',amount_received:1000,change_amount:40}});
    assert.ok(!html.includes('เบียร์ลีโอ'));
    assert.match(html,/ค่าใช้จ่ายเพิ่มเติม/);
    assert.match(html,/PAID · ชำระเงินแล้ว/);
});
