const express = require('express');
const router = express.Router();
const servingController = require('../controllers/serving.controller');

router.get('/serving', servingController.getDashboard);
router.post('/serving/confirm-served', servingController.confirmServed);

module.exports = router;
