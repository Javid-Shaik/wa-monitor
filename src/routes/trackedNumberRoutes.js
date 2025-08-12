const express = require('express');
const router = express.Router();
const { addTrackedNumberController, getTrackedNumbersController } = require('../controllers/trackedNumbersController');

// Route to add a tracked phone number
router.post('/add', addTrackedNumberController);

// Route to get all tracked numbers for a user
router.get('/:userId', getTrackedNumbersController);

module.exports = router;
