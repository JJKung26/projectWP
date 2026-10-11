const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createContext, runInContext } = require('vm');
function client(fetch) {
    const elements = {}, alerts = [];
    for (const id of ['payMethod','payCash','payPromptpay','payCard','cashDetails','promptpayDetails','cardNotice','amountReceived','changeAmount',
        'confirmPayment','promptpayVerified','promptpayQr','promptpayRecipient','promptpayStatus','reloadPromptpay'])
        elements[id] = {value:'',checked:false,disabled:false,hidden:false,textContent:'',decode:async()=>{}};
    elements.payCash.value = 'CASH';
    elements.payPromptpay.value = 'PROMPTPAY';
    elements.payCard.value = 'CREDIT_CARD';
    elements.payPromptpay.checked = true;
    elements.payMethod.querySelector = () => [elements.payCash,elements.payPromptpay,elements.payCard].find(input=>input.checked);
    elements.amountReceived.value = 600;
    const context = createContext({NET:600,SESSION_ID:'session',document:{getElementById:id=>elements[id]},
        requestFetch:fetch,dialogOpen(){},dialogClose(){},alert:text=>alerts.push(text),location:{href:'',reload(){this.reloaded=true;}}});
    runInContext(fs.readFileSync(path.join(__dirname,'../public/js/payment.js'),'utf8'),context);
    return {context,elements,alerts};
}
const qr = (amount=600) => ({json:async()=>({success:true,amount,number:'0812345678',qr_image:'data:image/png;base64,test'})});
const submit = context => context.submitPayment({preventDefault(){}});

test('PromptPay confirmation stays disabled until QR is decoded and staff verifies; double submit sends once', async () => {
    let release;
    const calls = [], gate = new Promise(resolve=>{release=resolve;});
    const view = client(async(url,options)=>{
        if (url.startsWith('/cashier/promptpay/')) return qr();
        calls.push(JSON.parse(options.body));
        await gate;
        return {json:async()=>({success:true,receipt_url:'/cashier/bill/session'})};
    });
    const {context,elements} = view;
    await context.loadPromptpay();
    assert.equal(elements.promptpayQr.hidden,false);
    assert.equal(elements.confirmPayment.disabled,true);
    await submit(context); assert.equal(calls.length,0);
    elements.promptpayVerified.checked = true;
    context.updatePaymentButton();
    const first = submit(context), second = submit(context);
    assert.equal(elements.payMethod.disabled,true);
    release(); await Promise.all([first,second]);
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0],{session_id:'session',payment_method:'PROMPTPAY',amount_received:600,expected_total:600,promptpay_verified:true});
    assert.equal(context.location.href,'/cashier/bill/session');
});
test('out-of-order QR requests and changing to cash cannot restore an old QR or verification', async () => {
    const replies = [], view = client(()=>new Promise(resolve=>replies.push(resolve)));
    const first = view.context.loadPromptpay(), second = view.context.loadPromptpay();
    replies[1](qr()); await second;
    view.elements.promptpayVerified.checked=true; view.context.updatePaymentButton();
    replies[0](qr(601)); await first;
    assert.equal(view.elements.confirmPayment.disabled,false);
    assert.match(view.elements.promptpayStatus.textContent,/แอปธนาคาร/);
    const third = view.context.loadPromptpay();
    assert.equal(view.elements.promptpayVerified.checked,false);
    view.elements.payPromptpay.checked=false; view.elements.payCash.checked=true; view.context.togglePayDetails();
    replies[2](qr()); await third;
    assert.equal(view.elements.promptpayDetails.hidden,true);
    assert.equal(view.elements.cashDetails.hidden,false);
    assert.equal(view.elements.confirmPayment.disabled,false);
    assert.equal(view.elements.promptpayQr.hidden,true);
});
test('changed bill, failed QR and lost payment response keep retry usable without recording automatically', async () => {
    const view = client(async()=>qr(601));
    await view.context.loadPromptpay();
    assert.equal(view.elements.confirmPayment.disabled,true);
    assert.match(view.elements.promptpayStatus.textContent,/ยอดบิลเปลี่ยน/);
    view.context.requestFetch = async()=>{throw new TypeError('offline');};
    await view.context.loadPromptpay();
    assert.equal(view.elements.promptpayVerified.disabled,true);
    assert.match(view.elements.promptpayStatus.textContent,/โหลด QR ไม่สำเร็จ/);
    view.context.requestFetch = async()=>qr();
    await view.context.loadPromptpay();
    view.elements.promptpayVerified.checked=true; view.context.updatePaymentButton();
    view.context.requestFetch = async()=>{throw new Error('lost response');};
    await submit(view.context);
    assert.equal(view.elements.confirmPayment.disabled,false);
    assert.equal(view.elements.payMethod.disabled,false);
    assert.match(view.alerts.at(-1),/กดอีกครั้ง/);
    assert.equal(view.context.location.href,'');
});
