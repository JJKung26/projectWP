const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runInNewContext } = require('vm');
const { check } = require('../utils/validation');

// อ่านฟิลด์จาก payload โดยตรง เพื่อตรวจผู้รับ ยอด สกุลเงิน และชนิด QR
function fields(payload) {
    const result = {};
    for (let offset = 0; offset < payload.length;) {
        const tag = payload.slice(offset,offset+2), length = Number(payload.slice(offset+2,offset+4));
        assert.ok(Number.isInteger(length) && length > 0 && offset+4+length <= payload.length);
        result[tag] = payload.slice(offset+4,offset+4+length);
        offset += 4 + length;
    }
    return result;
}
function utility(config) {
    const context = {module:{exports:{}},__dirname:path.join(__dirname,'../utils'),require:name=>{
        if (name === 'fs') return {readFileSync:()=>config};
        if (name === './validation') return {check};
        return require(name);
    }};
    runInNewContext(fs.readFileSync(path.join(__dirname,'../utils/promptpay.js'),'utf8'),context);
    return context.module.exports;
}
test('PromptPay config preserves leading zeroes and builds amount-specific THB QR payloads', () => {
    for (const number of ['0812345678','0105551234567']) {
        const api = utility(JSON.stringify({promptpayNumber:number}));
        const result = api.paymentPayload(600);
        const tags = fields(result.payload), merchant = fields(tags['29']);
        assert.equal(tags['00'],'01'); assert.equal(tags['01'],'12');
        assert.equal(tags['53'],'764'); assert.equal(tags['54'],'600.00'); assert.equal(tags['58'],'TH');
        assert.equal(merchant['00'],'A000000677010111');
        assert.equal(merchant[number.length===10 ? '01' : '02'],number.length===10 ? '0066'+number.slice(1) : number);
        assert.match(tags['63'],/^[A-F0-9]{4}$/);
        assert.equal(result.number,number);
        assert.notEqual(api.paymentPayload(601).payload,result.payload);
    }
});
test('missing or invalid config and zero/fractional amounts cannot create payment QR', () => {
    for (const config of ['{','{}','{"promptpayNumber":811234567}','{"promptpayNumber":"123"}','{"promptpayNumber":"not-a-number"}'])
        assert.throws(()=>utility(config).paymentPayload(600),/config.json/);
    const api = utility('{"promptpayNumber":"0812345678"}');
    for (const amount of [0,-1,600.81,'600',NaN,Infinity,1000001]) assert.throws(()=>api.paymentPayload(amount),/ยอดพร้อมเพย์/);
});
module.exports = { fields };
