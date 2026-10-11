const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createContext, runInContext } = require('vm');
const ejs = require('ejs');

test('calling a queue unlocks audio before the request; unavailable audio still allows calling', async () => {
    const source = fs.readFileSync(path.join(__dirname,'../views/cashier/tables.ejs'),'utf8');
    const callCode = source.slice(source.indexOf('        async function callQueue('),source.indexOf('        function openSeatModal('));
    const audioCode = fs.readFileSync(path.join(__dirname,'../public/js/queue-voice.js'),'utf8');
    for (const unavailable of [false,true]) {
        const events = [], notice = {textContent:''};
        const context = createContext({window:{AudioContext:class {
            constructor() { if (unavailable) throw Error('audio unavailable'); this.state='suspended'; this.currentTime=0; }
            async resume() { events.push('resume'); this.state='running'; }
            createOscillator() { return {frequency:{},connect(){},start(){events.push('chime');},stop(){}}; }
            createGain() { return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }
        }},document:{getElementById:id=>{assert.equal(id,'queueNotice');return notice;}},
            requestFetch:async (_url,options)=>{events.push('request');assert.equal(JSON.parse(options.body).queue_ticket_id,'ticket');return {json:async()=>({success:true,queue_no:'Q001'})};},
            alert(){},loadQueues(){}});
        runInContext(audioCode + callCode,context);
        await context.callQueue('ticket');
        assert.deepEqual(events,unavailable ? ['request'] : ['resume','request']);
        runInContext('playChime()',context);
        assert.equal(events.filter(e=>e==='chime').length,unavailable ? 0 : 1);
    }
});

function queueVoiceClient(gate = Promise.resolve()) {
    const sources = [], requests = [], notice = {textContent:''};
    const context = createContext({window:{AudioContext:class {
        constructor() { this.state='running'; this.currentTime=1; }
        async resume() {}
        createOscillator() { return {frequency:{},connect(){},start(){},stop(){}}; }
        createGain() { return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }
        async decodeAudioData(bytes) { return {name:bytes.toString(),duration:0.5}; }
        createBufferSource() {
            const source = {connect(){},start(time){this.time=time;},stop(){this.stopped=true;this.onended?.();}};
            sources.push(source);
            return source;
        }
    }},document:{getElementById:()=>notice},requestFetch:async url=>{
        requests.push(url);
        await gate;
        return {ok:true,arrayBuffer:async()=>Buffer.from(path.basename(url,'.wav'))};
    }});
    runInContext(fs.readFileSync(path.join(__dirname,'../public/js/queue-voice.js'),'utf8'),context);
    return {context,sources,requests,notice};
}

test('female queue clips preserve leading zeroes, finish in order, and cache audio', async () => {
    const client = queueVoiceClient();
    await client.context.enableSound();
    await client.context.announceQueue('Q001');
    assert.deepEqual(client.sources.map(s=>s.buffer.name),['intro','0','0','1','outro']);
    assert.ok(client.sources.every((s,i)=>i===0 || s.time > client.sources[i-1].time + client.sources[i-1].buffer.duration));
    assert.equal(client.notice.textContent,'กำลังประกาศคิว Q001');
    client.sources.at(-1).onended();
    assert.equal(client.notice.textContent,'ประกาศคิว Q001 แล้ว');
    await client.context.announceQueue('Q1000');
    assert.deepEqual(client.sources.slice(5).map(s=>s.buffer.name),['intro','1','0','0','0','outro']);
    assert.equal(client.requests.length,12);
});

test('a new queue replaces pending and playing announcements; old endings cannot overwrite it', async () => {
    let release;
    const client = queueVoiceClient(new Promise(resolve=>{release=resolve;}));
    await client.context.enableSound();
    const first = client.context.announceQueue('Q001');
    await Promise.resolve();
    const second = client.context.announceQueue('Q002');
    release();
    await Promise.all([first,second]);
    assert.deepEqual(client.sources.map(s=>s.buffer.name),['intro','0','0','2','outro']);
    const oldEnd = client.sources.at(-1).onended;
    await client.context.announceQueue('Q003');
    assert.ok(client.sources.slice(0,5).every(s=>s.stopped));
    oldEnd();
    assert.equal(client.notice.textContent,'กำลังประกาศคิว Q003');
    client.sources.at(-1).onended();
    assert.equal(client.notice.textContent,'ประกาศคิว Q003 แล้ว');
    assert.equal(client.requests.length,12);
});

test('failed audio loading shows a notice and allows retry without blocking a queue', async () => {
    const client = queueVoiceClient();
    await client.context.enableSound();
    const workingFetch = client.context.requestFetch;
    client.context.requestFetch = async()=>({ok:false});
    await client.context.announceQueue('Q001');
    assert.equal(client.sources.length,0);
    assert.match(client.notice.textContent,/เล่นเสียงไม่ได้/);
    client.context.requestFetch = workingFetch;
    await client.context.announceQueue('Q001');
    assert.equal(client.sources.length,5);
    assert.equal(client.notice.textContent,'กำลังประกาศคิว Q001');
});

test('all female queue voice assets are valid WAV files', () => {
    for (const name of ['intro','outro',...'0123456789']) {
        const bytes = fs.readFileSync(path.join(__dirname,'../public/audio/queue',name+'.wav'));
        assert.equal(bytes.toString('ascii',0,4),'RIFF');
        assert.equal(bytes.toString('ascii',8,12),'WAVE');
        assert.ok(bytes.length>1000);
    }
});

function element() {
    const classes = new Set();
    return { disabled:false, textContent:'', innerHTML:'', id:'', dataset:{},
        classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),
            toggle:(c,on)=>on ? classes.add(c) : classes.delete(c)},
        contains:()=>false, matches:()=>false, focus(){}, setAttribute(){} };
}
function menuClient(store = new Map(), available = 1) {
    const elements = new Map(), socketEvents = {};
    const document = {getElementById:id=>{
        if (!elements.has(id)) elements.set(id,element());
        return elements.get(id);
    },querySelector:()=>null,querySelectorAll:()=>[],body:element()};
    const context = createContext({document,window:{location:{}},crypto:require('crypto').webcrypto,
        sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
        setTimeout:()=>1,clearTimeout(){},diningEnded(){},IntersectionObserver:class{observe(){}},
        io:()=>({on:(name,fn)=>socketEvents[name]=fn}), requestFetch:async()=>{throw Error('offline');}});
    const html = ejs.render(fs.readFileSync(path.join(__dirname,'../views/customer/menu.ejs'),'utf8'),{
        token:'test-token',session:{table_no:'1'},categories:[{category_id:'C1',category_name:'อาหาร'}],
        menuItems:[{menu_item_id:'M1',item_name:'หมู',image_url:'',charge_type:'BUFFET',unit_price:0,availability:available,category_id:'C1'}]
    }, {filename:path.join(__dirname,'../views/customer/menu.ejs')});
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    runInContext(script,context);
    return {context,document,store,socketEvents};
}

test('lost response unlocks button; retry after reload and sold-out keeps same key and items', async () => {
    const first = menuClient(), requests = [];
    first.context.requestFetch = async (_url,options) => { requests.push(JSON.parse(options.body)); throw Error('response lost'); };
    first.context.setQty('M1',2);
    await first.context.submitOrder();
    assert.equal(first.context.window.orderSending,false);
    assert.equal(first.document.getElementById('sendBtn').disabled,false);
    assert.ok(first.store.has('cart:test-token:pending'));
    const reloaded = menuClient(first.store,0);
    assert.equal(reloaded.document.getElementById('cartCount').textContent,2);
    assert.equal(reloaded.document.getElementById('cartBar').classList.contains('show'),true);
    reloaded.context.requestFetch = async (_url,options) => {
        requests.push(JSON.parse(options.body));
        return {status:200,json:async()=>({success:true,order_id:'existing-order'})};
    };
    await reloaded.context.submitOrder();
    assert.deepEqual(requests[1],requests[0]);
    assert.equal(first.store.has('cart:test-token:pending'),false);
    assert.match(reloaded.context.window.location.href,/sent=1/);
});

test('double click sends once and malformed response retains retry key', async () => {
    const client = menuClient();
    client.context.setQty('M1',1);
    let finish, count = 0;
    client.context.requestFetch = async () => {
        count++;
        await new Promise(resolve=>finish=resolve);
        return {status:200,json:async()=>{throw Error('invalid JSON');}};
    };
    const sending = client.context.submitOrder();
    await client.context.submitOrder();
    assert.equal(count,1);
    assert.equal(client.document.getElementById('sendBtn').disabled,true);
    finish(); await sending;
    assert.equal(client.context.window.orderSending,false);
    assert.ok(client.store.has('cart:test-token:pending'));
});

test('unexpected error during request preparation still unlocks button', async () => {
    const client = menuClient();
    client.context.setQty('M1',1);
    client.context.crypto = {getRandomValues(){throw Error('crypto unavailable');}};
    await client.context.submitOrder();
    assert.equal(client.context.window.orderSending,false);
    assert.equal(client.document.getElementById('sendBtn').disabled,false);
});

test('refresh finishing after modal opens preserves form; burst events merge and resume', async () => {
    const region = element(), events = {}, timers = new Map();
    region.innerHTML = 'old';
    let modal = false, timerId = 0, finish, requests = 0;
    const context = createContext({window:{},location:{pathname:'/cashier/tables',search:''},
        document:{activeElement:element(),querySelector:s=>s==='#region' ? region : modal ? element() : null,
            querySelectorAll:()=>[],getElementById:()=>null},
        DOMParser:class{parseFromString(){return {querySelector:()=>({innerHTML:'latest'})};}},
        requestFetch:async()=>{
            requests++;
            await new Promise(resolve=>finish=resolve);
            return {ok:true,text:async()=>'<div>latest</div>'};
        },
        setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},
        clearTimeout:id=>timers.delete(id),setInterval:()=>1});
    runInContext(fs.readFileSync(path.join(__dirname,'../public/js/live.js'),'utf8'),context);
    context.liveRegion({auth:{},on:(name,fn)=>events[name]=fn},['#region'],['new-order']);
    for (let i=0;i<30;i++) events['new-order']();
    assert.equal(timers.size,1);
    const start = timers.values().next().value; timers.clear();
    const inFlight = start();
    modal = true; finish(); await inFlight;
    assert.equal(region.innerHTML,'old');
    modal = false;
    const resume = timers.values().next().value; timers.clear();
    const next = resume(); finish(); await next;
    assert.equal(region.innerHTML,'latest');
    assert.equal(requests,2);
});
