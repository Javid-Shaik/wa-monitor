const express = require('express');
const router = express.Router();
const trackedNumbersController = require('../controllers/trackedNumberController');

router.post('/add', trackedNumbersController.addTrackedNumberController);
router.get('/:userId', trackedNumbersController.getTrackedNumbersController);

module.exports = router;