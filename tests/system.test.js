const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { once } = require('events');
const { io: client } = require('socket.io-client');
const { Script } = require('vm');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'restaurant-test-'));
process.env.DB_PATH = path.join(directory, 'test.db');
process.env.SESSION_SECRET = randomUUID() + randomUUID();
process.env.PUBLIC_URL = 'http://192.168.1.100:3000';
const db = require('../database/database');
const { app, server, io, start } = require('../server');
const { totals } = require('../utils/billing');
let base, cashier, kitchen, service, first, second, menu;
async function request(url, body, cookie = cashier) {
    const response = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type':'application/json', Cookie: cookie || '' },
        body: body === undefined ? undefined : JSON.stringify(body), redirect:'manual' });
    const content = await response.text();
    let data;
    try { data = JSON.parse(content); } catch { data = content; }
    return { status:response.status, data, response };
}
async function login(username, password) {
    const result = await request('/login', { username, password }, '');
    assert.equal(result.status,302);
    return result.response.headers.get('set-cookie').split(';')[0];
}
async function open(table_id, buffet_price = 279) {
    const result = await request('/cashier/open-table', { table_id, guest_count:2, buffet_price });
    assert.equal(result.status,200,JSON.stringify(result.data));
    return result.data;
}
async function order(session, items = [{ menu_item_id:menu.menu_item_id, quantity:1 }], key = randomUUID()) {
    return request('/orders', { token:session.qr_token, items, request_key:key }, '');
}
async function socket(auth, cookie) {
    const connection = client(base, { auth, extraHeaders:{ Cookie:cookie || '' }, transports:['websocket'], reconnection:false });
    await Promise.race([once(connection,'connect'),once(connection,'connect_error').then(([err]) => { throw err; })]);
    return connection;
}
function delay(ms = 80) { return new Promise(resolve => setTimeout(resolve, ms)); }
before(async () => {
    await start(0);
    if (!server.listening) await once(server,'listening');
    base = 'http://127.0.0.1:' + server.address().port;
    cashier = await login('cashier1','cashier123');
    kitchen = await login('kitchen1','kitchen123');
    service = await login('service1','service123');
    menu = await db.get("SELECT * FROM MenuItem WHERE charge_type = 'BUFFET' AND availability=1 LIMIT 1");
});
after(async () => {
    await new Promise(resolve => io.close(resolve));
    await new Promise(resolve => db.db.close(resolve));
    fs.rmSync(directory,{ recursive:true,force:true });
});
test('round only final total after VAT using integer satang', () => {
    for (const [price,before,net,tax] of [[587,628.09,628,41.09],[280.45,300.08,300,19.63],[1000,1070,1070,70]]) {
        const amount = totals({guest_count:1,buffet_price:price},[]);
        assert.equal(amount.beforeRounding,before);
        assert.equal(amount.netAmount,net);
        assert.equal(amount.taxAmount,tax);
        assert.equal(Math.round(amount.roundingAmount*100), Math.round((net-before)*100));
    }
});

test('fresh installation starts empty with 50 free tables and exactly the current menu images', async () => {
    for (const table of ['QueueTicket','DiningSession','FoodOrder','OrderItem','Bill','Payment']) {
        assert.equal((await db.get('SELECT COUNT(*) n FROM '+table)).n,0);
    }
    assert.equal((await db.get('SELECT COUNT(*) n FROM Employee')).n,7);
    assert.equal((await db.get("SELECT COUNT(*) n FROM DiningTable WHERE table_status='AVAILABLE'")).n,50);
    assert.equal((await db.get("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN ('ServiceType','ServiceRequest')")).n,0);
    const items = await db.query('SELECT image_url,availability,is_active FROM MenuItem');
    assert.equal(items.length,56);
    assert.ok(items.every(item=>item.availability===1 && item.is_active===1));
    const categories = await db.query('SELECT category_id FROM Category ORDER BY sort_order');
    assert.deepEqual(categories.map(row=>row.category_id),['CAT-MEAT','CAT-SEAFOOD','CAT-VEG','CAT-BALL','CAT-SNACK','CAT-NOODLE','CAT-DRINK','CAT-DESSERT']);
    const images = [...new Set(items.map(item=>item.image_url).concat('/images/hero.jpg'))].sort();
    const directory = path.join(__dirname,'../public/images');
    assert.deepEqual(fs.readdirSync(directory).filter(name=>/\.(png|jpg|jpeg|webp|svg)$/i.test(name)).map(name=>'/images/'+name).sort(),images);
    const responses = await Promise.all(images.map(url=>request(url,undefined,'')));
    assert.ok(responses.every(result=>result.status===200),'all retained images must load');
});

test('30 concurrent opens create exactly one ACTIVE session', async () => {
    const results = await Promise.all(Array.from({length:30}, () => request('/cashier/open-table',{table_id:'TBL-01',guest_count:2,buffet_price:279})));
    assert.equal(results.filter(r => r.status===200).length,1);
    assert.equal(results.filter(r => r.status===409).length,29);
    first = results.find(r => r.status===200).data;
    assert.equal((await db.get("SELECT COUNT(*) n FROM DiningSession WHERE table_id='TBL-01' AND session_status='ACTIVE'")).n,1);
    second = await open('TBL-02');
});
test('30 concurrent orders are complete and unique, retry returns same order', async () => {
    const keys = Array.from({length:30}, () => randomUUID());
    const begin = Date.now();
    const results = await Promise.all(keys.map(key => order(first,undefined,key)));
    assert.ok(results.every(r => r.status===200),JSON.stringify(results));
    assert.equal(new Set(results.map(r=>r.data.order_id)).size,30);
    const replay = await order(first,undefined,keys[0]);
    assert.equal(replay.data.order_id,results[0].data.order_id);
    assert.equal(replay.data.replay,true);
    const changed = await order(first,[{menu_item_id:menu.menu_item_id,quantity:2}],keys[0]);
    assert.equal(changed.status,409);
    const count = await db.get('SELECT COUNT(*) n,COUNT(DISTINCT round_no) rounds FROM FoodOrder WHERE session_id=?',[first.session_id]);
    assert.equal(count.n,30); assert.equal(count.rounds,30);
    assert.equal((await db.get('SELECT COUNT(*) n FROM OrderItem oi JOIN FoodOrder fo ON fo.order_id=oi.order_id WHERE fo.session_id=?',[first.session_id])).n,30);
    console.log('30 simultaneous orders:',Date.now()-begin,'ms');
});
test('30 concurrent queue tickets use distinct daily sequence and original time', async () => {
    const results = await Promise.all(Array.from({length:30}, () => request('/cashier/queue/issue',{guest_count:2})));
    assert.ok(results.every(r => r.status===200));
    assert.equal(new Set(results.map(r => r.data.ticket.queue_no)).size,30);
    assert.equal(new Set(results.map(r => r.data.ticket.queue_ticket_id)).size,30);
    const ticket = results[0].data.ticket;
    const reprint = await request('/cashier/queue/ticket/'+ticket.queue_ticket_id);
    assert.equal(reprint.data.ticket.created_at,ticket.created_at);
    await request('/cashier/queue/cancel',{queue_ticket_id:ticket.queue_ticket_id});
    assert.equal((await request('/cashier/queue/call',{queue_ticket_id:ticket.queue_ticket_id})).status,409);
    assert.equal((await request('/cashier/queue/seat',{queue_ticket_id:ticket.queue_ticket_id,table_id:'TBL-03',buffet_price:279})).status,409);
    const list = await request('/cashier/queue/list');
    assert.equal(list.data.totalWaiting,29);
    assert.deepEqual(list.data.queues.map(q=>Number(q.queue_no.slice(1))),Array.from({length:29},(_,i)=>i+2));
});
test('server rejects bad counts, quantities, nonexistent IDs, occupied table and sold-out items', async () => {
    for (const count of [0,-1,1.5,5,'abc',null]) assert.equal((await request('/cashier/open-table',{table_id:'TBL-03',guest_count:count,buffet_price:279})).status,400);
    assert.equal((await request('/cashier/open-table',{table_id:'missing',guest_count:2,buffet_price:279})).status,404);
    await db.run("UPDATE DiningTable SET table_status='OCCUPIED' WHERE table_id='TBL-03'");
    assert.equal((await request('/cashier/open-table',{table_id:'TBL-03',guest_count:2,buffet_price:279})).status,409);
    for (const quantity of [0,-1,1.5,21,null]) assert.equal((await order(second,[{menu_item_id:menu.menu_item_id,quantity}])).status,400);
    assert.equal((await order(second,[])).status,400);
    assert.equal((await order(second,[{menu_item_id:'missing',quantity:1}])).status,404);
    assert.equal((await request('/kitchen/toggle-stock',{menu_item_id:'missing',availability:0},kitchen)).status,404);
    await request('/kitchen/toggle-stock',{menu_item_id:menu.menu_item_id,availability:0},kitchen);
    assert.equal((await order(second)).status,409);
    await request('/kitchen/toggle-stock',{menu_item_id:menu.menu_item_id,availability:1},kitchen);
});
test('mid-order database failure rolls back all items and allows retry', async () => {
    const other = await db.get('SELECT * FROM MenuItem WHERE menu_item_id != ? AND availability=1 LIMIT 1',[menu.menu_item_id]);
    await db.run("CREATE TRIGGER fail_item BEFORE INSERT ON OrderItem WHEN NEW.menu_item_id = '"+other.menu_item_id+"' BEGIN SELECT RAISE(ABORT,'test failure'); END");
    const items = [{menu_item_id:menu.menu_item_id,quantity:1},{menu_item_id:other.menu_item_id,quantity:1}];
    const key = randomUUID();
    assert.equal((await order(second,items,key)).status,500);
    assert.equal((await db.get('SELECT COUNT(*) n FROM FoodOrder WHERE session_id=?',[second.session_id])).n,0);
    await db.run('DROP TRIGGER fail_item');
    assert.equal((await order(second,items,key)).status,200);
});
test('legal kitchen/service transitions only, general cancel keeps stock', async () => {
    const item = await db.get('SELECT oi.* FROM OrderItem oi JOIN FoodOrder fo ON fo.order_id=oi.order_id WHERE fo.session_id=? LIMIT 1',[second.session_id]);
    assert.equal((await request('/serving/confirm-served',{order_item_id:item.order_item_id},service)).status,409);
    assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'READY'},kitchen)).status,409);
    assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'COOKING'},kitchen)).status,200);
    assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'READY'},kitchen)).status,200);
    assert.equal((await request('/serving/confirm-served',{order_item_id:item.order_item_id},service)).status,200);
    assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'COOKING'},kitchen)).status,409);
    const another = await db.get("SELECT oi.* FROM OrderItem oi JOIN FoodOrder fo ON fo.order_id=oi.order_id WHERE fo.session_id=? AND item_status='PENDING' LIMIT 1",[second.session_id]);
    await request('/kitchen/update-status',{order_item_id:another.order_item_id,status:'CANCELLED'},kitchen);
    assert.equal((await db.get('SELECT availability FROM MenuItem WHERE menu_item_id=?',[another.menu_item_id])).availability,1);
    assert.equal((await request('/kitchen/update-status',{order_id:'missing',status:'COOKING'},kitchen)).status,404);
});
test('cash zero / invalid method / stale total / pending food do not close session', async () => {
    const pay = {session_id:second.session_id,payment_method:'CASH',amount_received:0,expected_total:597};
    assert.equal((await request('/cashier/payment',pay)).status,400);
    assert.equal((await request('/cashier/payment',{...pay,payment_method:'INVALID',amount_received:1000})).status,400);
    assert.equal((await request('/cashier/payment',{...pay,amount_received:1000,expected_total:1})).status,409);
    assert.equal((await request('/cashier/payment',{...pay,session_id:first.session_id,amount_received:1000})).status,409);
    assert.equal((await db.get('SELECT COUNT(*) n FROM Bill')).n,0);
});
test('failure during Payment rolls back Bill, session and table then retry succeeds', async () => {
    await db.run("CREATE TRIGGER fail_payment BEFORE INSERT ON Payment BEGIN SELECT RAISE(ABORT,'payment failure'); END");
    const pay = {session_id:second.session_id,payment_method:'CASH',amount_received:1000,expected_total:597};
    assert.equal((await request('/cashier/payment',pay)).status,500);
    assert.equal((await db.get('SELECT COUNT(*) n FROM Bill')).n,0);
    assert.equal((await db.get('SELECT session_status FROM DiningSession WHERE session_id=?',[second.session_id])).session_status,'ACTIVE');
    assert.equal((await db.get("SELECT table_status FROM DiningTable WHERE table_id='TBL-02'")).table_status,'OCCUPIED');
    await db.run('DROP TRIGGER fail_payment');
    const results = await Promise.all(Array.from({length:10},()=>request('/cashier/payment',pay)));
    assert.ok(results.every(r=>r.status===200));
    assert.equal(new Set(results.map(r=>r.data.receipt_no)).size,1);
    assert.equal((await db.get('SELECT COUNT(*) n FROM Payment')).n,1);
    assert.equal((await db.get("SELECT table_status FROM DiningTable WHERE table_id='TBL-02'")).table_status,'AVAILABLE');
    const payment = await db.get('SELECT * FROM Payment');
    assert.equal(payment.amount_received,1000); assert.equal(payment.change_amount,403); assert.ok(payment.paid_at);
});
test('paid receipt is immutable, cannot order or update closed session', async () => {
    const receipt = await request('/cashier/bill/'+second.session_id);
    assert.equal(receipt.status,200); assert.match(receipt.data,/PAID/); assert.match(receipt.data,/Rounding/);
    assert.doesNotMatch(receipt.data, /<small style="display:block">/);
    await db.run("UPDATE MenuItem SET unit_price=999,item_name='changed' WHERE menu_item_id=?",[menu.menu_item_id]);
    assert.equal((await request('/cashier/bill/'+second.session_id)).data,receipt.data);
    assert.equal((await order(second)).status,409);
    const item = await db.get('SELECT oi.* FROM OrderItem oi JOIN FoodOrder fo ON fo.order_id=oi.order_id WHERE fo.session_id=? LIMIT 1',[second.session_id]);
    assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'COOKING'},kitchen)).status,409);
    assert.equal((await request('/cashier/reset-table',{table_id:'TBL-01',expected_status:'OCCUPIED',expected_session_id:first.session_id})).status,409);
    assert.equal((await request('/cashier/reset-table',{table_id:'TBL-02',expected_status:'AVAILABLE'})).status,200);
    await db.run('UPDATE MenuItem SET unit_price=? WHERE menu_item_id=?',[menu.unit_price,menu.menu_item_id]);
});
test('payment frees the table immediately; retrying the old payment cannot free a reopened table', async () => {
    const connection = await socket({role:'CASHIER'},cashier);
    try {
        const old = await open('TBL-47');
        const paidEvent = once(connection,'table-status-changed');
        const pay = {session_id:old.session_id,payment_method:'CASH',amount_received:1000,expected_total:597};
        assert.equal((await request('/cashier/payment',pay)).status,200);
        const [event] = await paidEvent;
        assert.deepEqual(event,{table_id:'TBL-47',table_status:'AVAILABLE'});
        assert.equal((await db.get("SELECT table_status FROM DiningTable WHERE table_id='TBL-47'")).table_status,'AVAILABLE');
        const current = await open('TBL-47');
        assert.equal((await request('/cashier/payment',pay)).status,200);
        assert.equal((await db.get("SELECT table_status FROM DiningTable WHERE table_id='TBL-47'")).table_status,'OCCUPIED');
        assert.equal((await db.get('SELECT session_status FROM DiningSession WHERE session_id=?',[current.session_id])).session_status,'ACTIVE');
        assert.equal((await order(old)).status,409);
        assert.equal((await request('/cashier/bill/'+old.session_id)).status,200);
        assert.equal((await request('/cashier/reset-table',{table_id:'TBL-47',expected_status:'OCCUPIED',expected_session_id:current.session_id})).status,200);
    } finally { connection.close(); }
});

test('all payment channels round 628.09 to 628 with unchanged VAT and cash change 372', async () => {
    for (const [index,method] of ['CASH','QR','CARD'].entries()) {
        const session = await open('TBL-'+String(10+index).padStart(2,'0'),293.50);
        const result = await request('/cashier/payment',{session_id:session.session_id,payment_method:method,amount_received:method==='CASH'?1000:628,expected_total:628,promptpay_verified:method==='QR'});
        assert.equal(result.status,200); assert.equal(result.data.net_amount,628);
        assert.equal((await db.get('SELECT table_status FROM DiningTable WHERE table_id=?',[session.table_id])).table_status,'AVAILABLE');
        const bill = await db.get('SELECT * FROM Bill WHERE session_id=?',[session.session_id]);
        assert.equal(bill.tax_amount,41.09); assert.equal(bill.before_rounding,628.09); assert.equal(bill.rounding_amount,-0.09);
        const pay = await db.get('SELECT * FROM Payment WHERE bill_id=?',[bill.bill_id]);
        assert.equal(pay.change_amount,method==='CASH'?372:0);
    }
});
test('concurrent order vs checkout never leaves unbilled active food in closed session', async () => {
    const session = await open('TBL-20');
    const results = await Promise.all([order(session),request('/cashier/payment',{session_id:session.session_id,payment_method:'CASH',amount_received:1000,expected_total:597})]);
    const state = await db.get('SELECT session_status FROM DiningSession WHERE session_id=?',[session.session_id]);
    if (state.session_status==='CLOSED') { assert.equal(results[1].status,200); assert.equal(results[0].status,409); }
    else { assert.equal(results[0].status,200); assert.equal(results[1].status,409); }
});
test('forged staff cookies and unauthorized sockets rejected; customer events stay within table', async () => {
    assert.equal((await request('/cashier/queue/list',undefined,'staff_CASHIER=EMP-001')).status,401);
    assert.equal((await request('/kitchen/toggle-stock',{menu_item_id:menu.menu_item_id,availability:1},cashier)).status,403);
    const bad = client(base,{auth:{role:'CASHIER'},extraHeaders:{Cookie:'staff_CASHIER=EMP-001'},transports:['websocket'],reconnection:false});
    await once(bad,'connect_error'); bad.close();
    const other = await open('TBL-30');
    const a = await socket({token:first.qr_token}), b = await socket({token:other.qr_token}), k = await socket({role:'KITCHEN'},kitchen);
    try {
        let aCount=0,bCount=0,kCount=0;
        a.on('new-order',()=>aCount++); b.on('new-order',()=>bCount++); k.on('new-order',()=>kCount++);
        assert.equal((await order(first)).status,200);
        await delay();
        assert.equal(aCount,1); assert.equal(bCount,0); assert.equal(kCount,1);
        let ended=false; b.on('session-closed',()=>ended=true);
        assert.equal((await request('/cashier/reset-table',{table_id:'TBL-30',expected_status:'OCCUPIED',expected_session_id:other.session_id})).status,200);
        await delay(); assert.equal(ended,true);
    } finally { a.close();b.close();k.close(); }
});
test('rendered pages and inline JavaScript compile, persisted QR survives reload', async () => {
    const qr = await request('/cashier/qr/'+first.qr_token);
    assert.equal(qr.status,200); assert.equal(qr.data.started_at,first.started_at);
    assert.ok(qr.data.customer_url.startsWith(process.env.PUBLIC_URL));
    assert.deepEqual(qr.data.buffet_totals,totals(first,[]));
    const buffetOnly = await open('TBL-33');
    assert.equal(buffetOnly.buffet_totals.subtotal,558);
    assert.equal(buffetOnly.buffet_totals.taxAmount,39.06);
    assert.equal(buffetOnly.buffet_totals.roundingAmount,-0.06);
    assert.equal(buffetOnly.buffet_totals.netAmount,597);
    for (const [url,cookie] of [
        ['/cashier/tables',cashier],['/cashier/receipts',cashier],['/cashier/bill/'+second.session_id,cashier],['/cashier/bill/'+buffetOnly.session_id,cashier],
        ['/kitchen',kitchen],['/serving',service],['/menu?token='+first.qr_token,''],['/orders?token='+first.qr_token,'']
    ]) {
        const page = await request(url,undefined,cookie);
        assert.equal(page.status,200,url);
        for (const [,code] of page.data.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(code,{filename:url});
    }
});


test('failed opening rolls back session and table; same queue cannot occupy two tables', async () => {
    await db.run("CREATE TRIGGER fail_table BEFORE UPDATE OF table_status ON DiningTable WHEN NEW.table_id='TBL-31' BEGIN SELECT RAISE(ABORT,'opening failure'); END");
    assert.equal((await request('/cashier/open-table',{table_id:'TBL-31',guest_count:2,buffet_price:279})).status,500);
    assert.equal((await db.get("SELECT COUNT(*) n FROM DiningSession WHERE table_id='TBL-31'")).n,0);
    assert.equal((await db.get("SELECT table_status FROM DiningTable WHERE table_id='TBL-31'")).table_status,'AVAILABLE');
    await db.run('DROP TRIGGER fail_table');
    const issued = await request('/cashier/queue/issue',{guest_count:2});
    const queue_ticket_id = issued.data.ticket.queue_ticket_id;
    const seated = await Promise.all(['TBL-31','TBL-32'].map(table_id => request('/cashier/queue/seat',{queue_ticket_id,table_id,buffet_price:279})));
    assert.equal(seated.filter(r=>r.status===200).length,1);
    assert.equal(seated.filter(r=>r.status===409).length,1);
    assert.equal((await db.get('SELECT COUNT(*) n FROM DiningSession WHERE queue_ticket_id=?',[queue_ticket_id])).n,1);
});
test('10 tables with 30 simultaneous diners complete kitchen, serving and payment consistently', async () => {
    const tables = Array.from({length:10},(_,i)=>'TBL-'+String(35+i).padStart(2,'0'));
    const sessions = await Promise.all(tables.map(table_id => open(table_id)));
    const begin = Date.now();
    const orders = await Promise.all(sessions.flatMap(session => Array.from({length:3},()=>order(session))));
    assert.ok(orders.every(r=>r.status===200));
    for (const status of ['COOKING','READY']) {
        const updates = await Promise.all(orders.map(r=>request('/kitchen/update-status',{order_id:r.data.order_id,status},kitchen)));
        assert.ok(updates.every(r=>r.status===200));
    }
    const served = await Promise.all(orders.map(r=>request('/serving/confirm-served',{order_id:r.data.order_id},service)));
    assert.ok(served.every(r=>r.status===200));
    const paid = await Promise.all(sessions.map(session=>request('/cashier/payment',{session_id:session.session_id,payment_method:'CASH',amount_received:1000.50,expected_total:597})));
    assert.ok(paid.every(r=>r.status===200));
    for (const session of sessions) {
        const row = await db.get(`SELECT s.session_status,t.table_status,b.bill_status,p.amount,p.amount_received,p.change_amount
            FROM DiningSession s JOIN DiningTable t ON s.table_id=t.table_id JOIN Bill b ON b.session_id=s.session_id
            JOIN Payment p ON p.bill_id=b.bill_id WHERE s.session_id=?`,[session.session_id]);
        assert.deepEqual([row.session_status,row.table_status,row.bill_status],['CLOSED','AVAILABLE','PAID']);
        assert.equal(row.amount_received,1000.50);assert.equal(row.change_amount,403.50);
        assert.equal((await order(session)).status,409);
    }
    assert.equal((await db.get("SELECT COUNT(*) n FROM (SELECT table_id FROM DiningSession WHERE session_status='ACTIVE' GROUP BY table_id HAVING COUNT(*)>1)")).n,0);
    assert.equal((await db.query('PRAGMA foreign_key_check')).length,0);
    console.log('10-table full flow with 30 simultaneous orders:',Date.now()-begin,'ms');
});
test('legacy schema migrates, password regeneration updates existing account, startup rejects duplicated active data', async () => {
    const { execFileSync } = require('child_process');
    const fixture = path.join(directory,'legacy-project');
    fs.mkdirSync(path.join(fixture,'database'),{recursive:true});
    fs.mkdirSync(path.join(fixture,'scripts'),{recursive:true});
    for (const f of ['database.js','schema.sql','seed.sql','seed-accounts.sql']) fs.copyFileSync(path.join(__dirname,'..','database',f),path.join(fixture,'database',f));
    const legacySchema = path.join(fixture,'database/schema.sql');
    fs.writeFileSync(legacySchema, fs.readFileSync(legacySchema,'utf8').replace(/\r\n/g,'\n').replace(/^    (child_count|free_child_count|child_price).*\r?\n/gm,'')
        .replace("('AVAILABLE', 'OCCUPIED')","('AVAILABLE', 'OCCUPIED', 'CLEANING')"));
    const oldPath = path.join(fixture,'old.db');
    const env = { ...process.env, DB_PATH:oldPath, NODE_PATH:path.join(__dirname,'..','node_modules') };
    const run = code => execFileSync(process.execPath,['-e',code],{cwd:fixture,env,encoding:'utf8',timeout:10000});
    run(`const fs=require('fs'), db=new(require('sqlite3').Database)(process.env.DB_PATH);
        db.exec(fs.readFileSync('database/schema.sql','utf8').replace('    password_hash TEXT NOT NULL,\\n','')+
        "INSERT INTO Employee(employee_id,username,full_name,role) VALUES('EMP-001','cashier1','old','CASHIER');",
        e=>{if(e)throw e;db.close()});`);
    const result = run("const d=require('./database/database');d.ready.then(()=>{console.log('READY');d.db.close()}).catch(e=>{console.log(e.message);d.db.close()});");
    assert.match(result,/password_hash/);
    let generator = fs.readFileSync(path.join(__dirname,'..','scripts','generate-accounts.js'),'utf8');
    generator = generator.replace("'cashier123'","'new-demo-password'");
    fs.writeFileSync(path.join(fixture,'scripts','generate-accounts.js'),generator);
    execFileSync(process.execPath,['scripts/generate-accounts.js'],{cwd:fixture,env,encoding:'utf8',timeout:10000});
    assert.match(run("const d=require('./database/database');d.ready.then(async()=>{const r=await d.get(\"SELECT password_hash FROM Employee WHERE username='cashier1'\");console.log(require('bcryptjs').compareSync('new-demo-password',r.password_hash));d.db.close()})"),/true/);
    assert.equal(run("const d=require('./database/database');d.ready.then(async()=>{const columns=await d.query('PRAGMA table_info(DiningSession)');console.log(['child_count','free_child_count','child_price'].map(name=>Number(columns.find(c=>c.name===name).dflt_value)).join(','));d.db.close()})").trim(),'0,0,179');
    run(`const d=require('./database/database');d.ready.then(async()=>{
        await d.run("UPDATE DiningTable SET table_status='CLEANING' WHERE table_id IN ('TBL-04','TBL-05')");
        await d.run("INSERT INTO DiningSession(session_id,table_id,opened_by,qr_token,guest_count) VALUES('still-active','TBL-05','EMP-001','still-active',2)");
        d.db.close();
    });`);
    assert.equal(run(`const d=require('./database/database');d.ready.then(async()=>{
        const rows=await d.query("SELECT table_status FROM DiningTable WHERE table_id IN ('TBL-04','TBL-05') ORDER BY table_id");
        const session=await d.get("SELECT session_status FROM DiningSession WHERE session_id='still-active'");
        console.log(rows.map(r=>r.table_status).join(',')+','+session.session_status);d.db.close();
    });`).trim(),'AVAILABLE,OCCUPIED,ACTIVE');
    run(`const d=require('./database/database');d.ready.then(async()=>{
        await d.run('DROP INDEX one_active_session');
        for(const id of ['old-a','old-b']) await d.run("INSERT INTO DiningSession(session_id,table_id,opened_by,qr_token,guest_count) VALUES(?,'TBL-01','EMP-001',?,2)",[id,id]);
        d.db.close();
    });`);
    assert.match(run("const d=require('./database/database');d.ready.then(()=>{console.log('UNEXPECTED READY');d.db.close()}).catch(e=>{console.log(e.code);d.db.close()});"),/SQLITE_CONSTRAINT/);
});

test('queue history finds closed tickets by Bangkok date; reprint never inserts', async () => {
    const day = require('../utils/validation').today();
    const history = await request('/cashier/queue/list?history=1&date='+day);
    assert.equal(history.status,200);
    assert.ok(history.data.queues.some(q=>q.queue_status==='CANCELLED'));
    const waiting = await request('/cashier/queue/list');
    assert.equal(history.data.totalWaiting,waiting.data.totalWaiting);
    const old = randomUUID();
    await db.run("INSERT INTO QueueTicket(queue_ticket_id,queue_no,queue_date,guest_count,queue_status,created_at) VALUES(?,'Q001','2020-01-01',2,'SEATED','2020-01-01 23:00:00')",[old]);
    const count = (await db.get('SELECT COUNT(*) n FROM QueueTicket')).n;
    const found = await request('/cashier/queue/list?history=1&date=2020-01-01');
    assert.equal(found.data.queues[0].queue_ticket_id,old);
    for (let i=0;i<2;i++) {
        const ticket = await request('/cashier/queue/ticket/'+old);
        assert.equal(ticket.data.ticket.created_at,'2020-01-01 23:00:00');
        assert.equal(ticket.data.ticket.count_ahead,0);
    }
    assert.equal((await db.get('SELECT COUNT(*) n FROM QueueTicket')).n,count);
    assert.equal((await request('/cashier/queue/call',{queue_ticket_id:old})).status,409);
    for (const invalid of ['2020-02-30','abc','2020-13-01'])
        assert.equal((await request('/cashier/queue/list?history=1&date='+invalid)).status,400);
});

test('stale reset cannot cancel a table reopened by another cashier', async () => {
    const old = await open('TBL-49');
    const reset = {table_id:'TBL-49',expected_status:'OCCUPIED',expected_session_id:old.session_id};
    assert.equal((await request('/cashier/reset-table',reset)).status,200);
    const current = await open('TBL-49');
    assert.equal((await request('/cashier/reset-table',reset)).status,409);
    assert.equal((await request('/cashier/reset-table',{table_id:'TBL-49',expected_status:'AVAILABLE'})).status,409);
    assert.equal((await db.get('SELECT session_status FROM DiningSession WHERE session_id=?',[current.session_id])).session_status,'ACTIVE');
});

test('invalid public URL leaves cashier usable and rejects opening before writes', async () => {
    const original = process.env.PUBLIC_URL;
    try {
        for (const url of ['http://localhost:3000','not-a-url']) {
            process.env.PUBLIC_URL = url;
            assert.equal((await request('/cashier/tables')).status,200);
            const result = await request('/cashier/open-table',{table_id:'TBL-48',guest_count:2,buffet_price:279});
            assert.equal(result.status,503);
            assert.match(result.data.message,/PUBLIC_URL/);
            assert.equal((await db.get("SELECT COUNT(*) n FROM DiningSession WHERE table_id='TBL-48'")).n,0);
        }
    } finally { process.env.PUBLIC_URL = original; }
});

test('two kitchen/service screens receive same status; reconnect fetches missed updates', async () => {
    const session = await open('TBL-47');
    const placed = await order(session);
    const item = await db.get('SELECT * FROM OrderItem WHERE order_id=?',[placed.data.order_id]);
    const k1 = await socket({role:'KITCHEN'},kitchen), k2 = await socket({role:'KITCHEN'},kitchen);
    const s1 = await socket({role:'SERVICE'},service), s2 = await socket({role:'SERVICE'},service);
    let diner = await socket({token:session.qr_token});
    try {
        const seen = [0,0,0,0];
        [k1,k2,s1,s2].forEach((connection,i)=>connection.on('order-status-changed',()=>seen[i]++));
        diner.close();
        assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'COOKING'},kitchen)).status,200);
        assert.equal((await request('/kitchen/update-status',{order_item_id:item.order_item_id,status:'READY'},kitchen)).status,200);
        await delay();
        assert.deepEqual(seen,[2,2,2,2]);
        diner = await socket({token:session.qr_token});
        const page = await request('/orders?token='+session.qr_token,undefined,'');
        assert.match(page.data,/กำลังนำไปเสิร์ฟ/);
        assert.equal((await request('/serving/confirm-served',{order_item_id:item.order_item_id},service)).status,200);
        await delay();
        assert.deepEqual(seen,[3,3,3,3]);
    } finally { [k1,k2,s1,s2,diner].forEach(connection=>connection.close()); }
});


test('adult, child and free child rates agree across QR, bill and paid snapshot', async () => {
    const result = await request('/cashier/open-table', {table_id:'TBL-45',adult_count:2,child_count:1,free_child_count:1,buffet_price:279,child_price:199.50});
    assert.equal(result.status,200);
    const session = result.data;
    assert.equal(session.guest_count,4);
    assert.equal(session.child_price,199.50);
    assert.deepEqual(session.buffet_totals, {buffetTotal:757.50,alacarteTotal:0,subtotal:757.50,taxAmount:53.03,beforeRounding:810.53,roundingAmount:-0.53,netAmount:810});
    const saved = await db.get('SELECT * FROM DiningSession WHERE session_id=?',[session.session_id]);
    assert.equal(saved.child_count,1); assert.equal(saved.free_child_count,1);
    assert.deepEqual((await request('/cashier/qr/'+session.qr_token)).data.buffet_totals,session.buffet_totals);
    const bill = await request('/cashier/bill/'+session.session_id);
    assert.equal(bill.status,200); assert.match(bill.data,/เด็ก 90–120 ซม./); assert.match(bill.data,/เด็กต่ำกว่า 90 ซม./);
    assert.match(bill.data,/199\.50/); assert.match(bill.data,/810\.00/);
    assert.equal((await request('/cashier/payment',{session_id:session.session_id,payment_method:'CASH',amount_received:820,expected_total:810})).data.change_amount,10);
    const receipt = await request('/cashier/bill/'+session.session_id);
    await db.run('UPDATE DiningSession SET child_price=999,child_count=0,free_child_count=0 WHERE session_id=?',[session.session_id]);
    assert.equal((await request('/cashier/bill/'+session.session_id)).data,receipt.data);
    assert.equal(totals({guest_count:1,child_count:0,free_child_count:1,buffet_price:279,child_price:179},[]).netAmount,0);
});

test('child counts are validated, include free seats, and must match the queue total', async () => {
    const body = {table_id:'TBL-46',adult_count:2,child_count:1,free_child_count:1,buffet_price:279};
    for (const change of [{child_count:-1},{child_count:0.5},{free_child_count:null},{adult_count:3},{adult_count:0,child_count:0,free_child_count:0},{adult_count:'abc'}, ...[-1,0,null,'abc','',2.345,10000.01].map(child_price=>({child_price}))])
        assert.equal((await request('/cashier/open-table',{...body,...change})).status,400);
    assert.equal((await db.get("SELECT COUNT(*) n FROM DiningSession WHERE table_id='TBL-46'")).n,0);
    const queued = (await request('/cashier/queue/issue',{guest_count:3})).data.ticket;
    assert.equal((await request('/cashier/queue/seat',{...body,queue_ticket_id:queued.queue_ticket_id})).status,400);
    assert.equal((await db.get('SELECT queue_status FROM QueueTicket WHERE queue_ticket_id=?',[queued.queue_ticket_id])).queue_status,'WAITING');
    const seated = await request('/cashier/queue/seat',{...body,adult_count:1,child_price:169,queue_ticket_id:queued.queue_ticket_id});
    assert.equal(seated.status,200); assert.equal(seated.data.guest_count,3);
    assert.equal(seated.data.child_price,169);
    assert.equal(seated.data.buffet_totals.buffetTotal,448);
    assert.equal((await db.get('SELECT queue_status FROM QueueTicket WHERE queue_ticket_id=?',[queued.queue_ticket_id])).queue_status,'SEATED');
});

test('Bangkok midnight restarts at Q001 and preserves the previous day for reprinting', async (t) => {
    t.mock.timers.enable({apis:['Date'],now:Date.parse('2030-01-01T16:59:59Z')}); // 23:59:59 เวลาไทย
    const issue = async () => {
        const result = await request('/cashier/queue/issue',{guest_count:2});
        assert.equal(result.status,200);
        return result.data.ticket;
    };
    const yesterday = await issue();
    assert.equal(yesterday.queue_date,'2030-01-01');
    assert.equal(yesterday.queue_no,'Q001');
    assert.equal((await issue()).queue_no,'Q002');

    t.mock.timers.setTime(Date.parse('2030-01-01T17:00:00Z')); // 00:00:00 วันถัดไปในไทย
    const today = await issue();
    assert.equal(today.queue_date,'2030-01-02');
    assert.equal(today.queue_no,'Q001');
    assert.notEqual(today.queue_ticket_id,yesterday.queue_ticket_id);
    assert.equal((await issue()).queue_no,'Q002');
    const waiting = (await request('/cashier/queue/list')).data;
    assert.equal(waiting.totalWaiting,2);
    assert.ok(waiting.queues.every(q=>q.queue_date==='2030-01-02'));

    const history = (await request('/cashier/queue/list?history=1&date=2030-01-01')).data;
    assert.deepEqual(history.queues.map(q=>q.queue_no),['Q001','Q002']);
    assert.equal((await request('/cashier/queue/ticket/'+yesterday.queue_ticket_id)).data.ticket.created_at,yesterday.created_at);
    assert.equal((await request('/cashier/queue/call',{queue_ticket_id:yesterday.queue_ticket_id})).status,409);
});

test('PromptPay QR decodes to the configured receiver and floor-rounded server total without writing a payment', async () => {
    const { PNG } = require('pngjs'), decode = require('jsqr');
    const session = await open('TBL-04',280.75); // 561.50 + VAT 39.31 = 600.81 -> 600
    const count = (await db.get('SELECT COUNT(*) n FROM Payment')).n;
    const url = '/cashier/promptpay/'+session.session_id;
    assert.equal((await request(url,undefined,'')).status,401);
    assert.equal((await request(url,undefined,kitchen)).status,403);
    assert.equal((await request('/cashier/promptpay/missing')).status,404);
    const qr = await request(url+'?amount=1&number=0811111111');
    assert.equal(qr.status,200); assert.equal(qr.data.amount,600);
    assert.equal(qr.response.headers.get('cache-control'),'no-store');
    const number = JSON.parse(fs.readFileSync(path.join(__dirname,'../config.json'),'utf8')).promptpayNumber;
    assert.equal(qr.data.number,number);
    const png = PNG.sync.read(Buffer.from(qr.data.qr_image.split(',')[1],'base64'));
    const result = decode(new Uint8ClampedArray(png.data),png.width,png.height);
    assert.ok(result,'generated image must be scannable');
    const tags = {};
    for (let offset=0;offset<result.data.length;) {
        const tag=result.data.slice(offset,offset+2), size=Number(result.data.slice(offset+2,offset+4));
        tags[tag]=result.data.slice(offset+4,offset+4+size); offset+=4+size;
    }
    assert.equal(tags['01'],'12'); assert.equal(tags['54'],'600.00'); assert.equal(tags['53'],'764');
    assert.ok(tags['29'].includes(number.length===10 ? '0066'+number.slice(1) : number));
    assert.equal((await db.get('SELECT COUNT(*) n FROM Payment')).n,count);
    assert.equal((await db.get('SELECT COUNT(*) n FROM Bill WHERE session_id=?',[session.session_id])).n,0);
    const placed = await order(session);
    assert.equal((await request(url)).status,409); // ยังมีอาหารค้าง
    await request('/kitchen/update-status',{order_id:placed.data.order_id,status:'CANCELLED'},kitchen);
    await request('/cashier/reset-table',{table_id:session.table_id,expected_status:'OCCUPIED',expected_session_id:session.session_id});
    assert.equal((await request(url)).status,409);
});

test('PromptPay requires staff verification, rejects stale totals, and concurrent confirmation pays only once', async () => {
    const session = await open('TBL-05',280.75);
    const pay = {session_id:session.session_id,payment_method:'PROMPTPAY',amount_received:600,expected_total:600};
    for (const verified of [undefined,false,'true',1]) {
        assert.equal((await request('/cashier/payment',{...pay,promptpay_verified:verified})).status,400);
    }
    assert.equal((await db.get('SELECT COUNT(*) n FROM Bill WHERE session_id=?',[session.session_id])).n,0);
    const verifiedPay = {...pay,promptpay_verified:true};
    await db.run('UPDATE DiningSession SET buffet_price=281 WHERE session_id=?',[session.session_id]);
    assert.equal((await request('/cashier/payment',verifiedPay)).status,409);
    assert.equal((await db.get('SELECT session_status FROM DiningSession WHERE session_id=?',[session.session_id])).session_status,'ACTIVE');
    await db.run('UPDATE DiningSession SET buffet_price=280.75 WHERE session_id=?',[session.session_id]);
    await db.run("CREATE TRIGGER fail_promptpay BEFORE INSERT ON Payment BEGIN SELECT RAISE(ABORT,'promptpay failure'); END");
    assert.equal((await request('/cashier/payment',verifiedPay)).status,500);
    assert.equal((await db.get('SELECT COUNT(*) n FROM Bill WHERE session_id=?',[session.session_id])).n,0);
    await db.run('DROP TRIGGER fail_promptpay');
    const results = await Promise.all(Array.from({length:15},()=>request('/cashier/payment',verifiedPay)));
    assert.ok(results.every(r=>r.status===200));
    assert.equal(new Set(results.map(r=>r.data.receipt_no)).size,1);
    const payment = await db.get('SELECT p.* FROM Payment p JOIN Bill b ON p.bill_id=b.bill_id WHERE b.session_id=?',[session.session_id]);
    assert.equal(payment.payment_method,'PROMPTPAY'); assert.equal(payment.amount,600); assert.equal(payment.change_amount,0);
    assert.equal((await db.get('SELECT COUNT(*) n FROM Payment p JOIN Bill b ON p.bill_id=b.bill_id WHERE b.session_id=?',[session.session_id])).n,1);
    assert.equal((await db.get('SELECT table_status FROM DiningTable WHERE table_id=?',[session.table_id])).table_status,'AVAILABLE');
    const receipt = await request('/cashier/bill/'+session.session_id);
    assert.match(receipt.data,/PAID/); assert.match(receipt.data,/600.00/); assert.doesNotMatch(receipt.data,/พร้อมเพย์ \(จำลอง\)/);
    assert.equal((await request('/cashier/promptpay/'+session.session_id)).status,409);
    const next = await open(session.table_id);
    assert.equal((await request('/cashier/payment',verifiedPay)).status,200);
    assert.equal((await db.get('SELECT session_status FROM DiningSession WHERE session_id=?',[next.session_id])).session_status,'ACTIVE');
    assert.equal((await db.get('SELECT table_status FROM DiningTable WHERE table_id=?',[session.table_id])).table_status,'OCCUPIED');
});


test('retired soda disappears from menu and stock, rejects new orders, and preserves historical orders after reseeding', async () => {
    assert.equal(await db.get("SELECT * FROM MenuItem WHERE menu_item_id='ITEM-406'"), undefined);
    assert.equal((await db.get('SELECT COUNT(*) n FROM MenuItem WHERE is_active=1')).n,56);
    const freeTable = await db.get("SELECT table_id FROM DiningTable WHERE table_status='AVAILABLE' LIMIT 1");
    const session = await open(freeTable.table_id);
    await db.run(`INSERT INTO MenuItem(menu_item_id,category_id,item_name,charge_type,unit_price,image_url)
        VALUES('ITEM-406','CAT-DRINK','น้ำอัดลม (แก้ว)','ALACARTE',25,'/images/soda.jpg')`);
    const placed = await order(session,[{menu_item_id:'ITEM-406',quantity:2}]);
    assert.equal(placed.status,200);
    const original = await db.get('SELECT * FROM OrderItem WHERE order_id=?',[placed.data.order_id]);
    const seed = fs.readFileSync(path.join(__dirname,'../database/seed.sql'),'utf8');
    for (let run=0;run<2;run++) {
        await db.transaction(() => new Promise((resolve,reject) => db.db.exec(seed,err => err ? reject(err) : resolve())));
        const archived = await db.get("SELECT * FROM MenuItem WHERE menu_item_id='ITEM-406'");
        assert.equal(archived.is_active,0); assert.equal(archived.availability,0);
        assert.equal(archived.image_url,'/images/drink_refill.png');
        assert.equal((await request(archived.image_url,undefined,'')).status,200);
        assert.deepEqual(await db.get('SELECT * FROM OrderItem WHERE order_id=?',[placed.data.order_id]),original);
    }
    const menuPage = await request('/menu?token='+session.qr_token,undefined,'');
    assert.equal(menuPage.status,200); assert.doesNotMatch(menuPage.data,/ITEM-406|น้ำอัดลม \(แก้ว\)/);
    assert.match(menuPage.data,/น้ำชา น้ำหวาน และน้ำอัดลม เติมได้/);
    const stock = await request('/menu/data?token='+session.qr_token,undefined,'');
    assert.ok(stock.data.menuItems.every(item => item.menu_item_id !== 'ITEM-406'));
    const kitchenPage = await request('/kitchen',undefined,kitchen);
    assert.equal(kitchenPage.status,200);
    assert.doesNotMatch(kitchenPage.data,/toggleStock\('ITEM-406'/);
    assert.match((await request('/orders?token='+session.qr_token,undefined,'')).data,/น้ำอัดลม \(แก้ว\)/);
    assert.equal((await request('/kitchen/toggle-stock',{menu_item_id:'ITEM-406',availability:1},kitchen)).status,404);
    await db.run("UPDATE MenuItem SET availability=1 WHERE menu_item_id='ITEM-406'");
    assert.equal((await order(session,[{menu_item_id:'ITEM-406',quantity:1}])).status,404);
    assert.equal((await db.get('SELECT COUNT(*) n FROM FoodOrder WHERE session_id=?',[session.session_id])).n,1);
    const refill = await db.get("SELECT * FROM MenuItem WHERE menu_item_id='ITEM-401'");
    assert.equal(refill.charge_type,'BUFFET'); assert.equal(refill.unit_price,0);
});
