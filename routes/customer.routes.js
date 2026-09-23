const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// QR Scan landing validation
router.get('/qr/:token', customerController.landingQr);

// Customer ordering menu page
router.get('/menu', customerController.getMenu);

// Submit order
router.post('/orders', customerController.placeOrder);

// Live order status page
router.get('/orders', customerController.getOrderStatus);

module.exports = router;
