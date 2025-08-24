const express = require('express');
const router = express.Router();
const trackedNumbersController = require('../controllers/trackedNumbersController');

router.post('/add', trackedNumbersController.addTrackedNumberController);
router.get('/contacts/:firebaseUid', trackedNumbersController.getTrackedNumbersController);

module.exports = router;