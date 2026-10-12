const router = require('express').Router();
const kitchenController = require('../controllers/kitchen.controller');
router.get('/kitchen', kitchenController.getDashboard);
router.post('/kitchen/update-status', kitchenController.updateStatus);
router.post('/kitchen/toggle-stock', kitchenController.toggleStock);
module.exports = router;
