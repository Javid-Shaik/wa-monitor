const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/watrackController');

router.post('/create-session', ctrl.createSessionController);        // create sessionId
router.post('/start-client', ctrl.startWhatsAppController);         // start/resume client
router.get('/qr-code/:sessionId', ctrl.getQrController);           // poll for qr
router.get('/status/:sessionId', ctrl.getStatusController);        // poll for link status
router.get('/qr-link/:qrId', ctrl.getQrPublicController); // get QR link by ID

router.post('/subscribe', ctrl.subscribeController);
router.post('/unsubscribe', ctrl.unsubscribeController);

router.get('/profile-pic/:sessionId/:phoneNumber', ctrl.getProfilePicController);
router.get('/in-contacts/:sessionId/:phoneNumber', ctrl.checkInContactsController);

router.get('/history/:trackingId', ctrl.getHistoryController);
router.get('/last-seen/:trackingId', ctrl.getLastSeenController);

module.exports = router;
