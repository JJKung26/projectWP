// กำหนด URL แล้วส่งคำขอไปยัง controller
const router = require('express').Router();
const queue = require('../controllers/queue.controller');
// อ่านบัตรคิวเดิม (GET)
router.get('/cashier/queue/ticket/:id', queue.getTicket);
// รับข้อมูลออกบัตรคิว (POST)
router.post('/cashier/queue/issue', queue.issueQueue);
// แสดงรายการคิว (GET)
router.get('/cashier/queue/list', queue.getQueues);
// รับคำสั่งเรียกคิว (POST)
router.post('/cashier/queue/call', queue.callQueue);
// รับข้อมูลจัดคิวเข้าโต๊ะ (POST)
router.post('/cashier/queue/seat', queue.seatQueue);
// รับคำสั่งยกเลิกคิว (POST)
router.post('/cashier/queue/cancel', queue.cancelQueue);
module.exports = router;
