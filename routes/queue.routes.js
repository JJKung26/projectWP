const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');

router.post('/cashier/queue/issue', queueController.issueQueue);
router.get('/cashier/queue/list', queueController.getQueues);
router.post('/cashier/queue/call', queueController.callQueue);
router.post('/cashier/queue/seat', queueController.seatQueue);
router.post('/cashier/queue/cancel', queueController.cancelQueue);

module.exports = router;
