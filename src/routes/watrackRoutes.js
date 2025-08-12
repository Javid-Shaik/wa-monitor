const express = require('express');
const router = express.Router();
const trackerController = require('../controllers/watrackController');

router.post('/subscribe', trackerController.subscribeController);
router.post('/unsubscribe', trackerController.unsubscribeController);
router.get('/profile-pic/:phoneNumber', trackerController.getProfilePicController);
router.get('/history/:trackingId', trackerController.getHistoryController);
router.get('/last-seen/:trackingId', trackerController.getLastSeenController);

module.exports = router;