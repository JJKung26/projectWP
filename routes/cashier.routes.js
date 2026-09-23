const express = require('express');
const router = express.Router();
const cashierController = require('../controllers/cashier.controller');

router.get('/cashier', cashierController.getTables);
router.get('/cashier/tables', cashierController.getTables);
router.post('/cashier/open-table', cashierController.openTable);
router.get('/cashier/qr/:token', cashierController.getQrCode);
router.get('/cashier/bill/:sessionId', cashierController.getBill);
router.post('/cashier/payment', cashierController.processPayment);
router.post('/cashier/reset-table', cashierController.resetTable);

module.exports = router;
