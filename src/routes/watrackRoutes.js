const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/watrackController");
const { getSessionByUserFirebaseId } = require("../controllers/userController");

//  Session management
router.post("/create-session", ctrl.createSessionController);        // Force create a new session (optional)
router.post("/ensure-session", ctrl.ensureSessionController);        // Ensure existing or create new (preferred for app)
router.post("/start-client", ctrl.startWhatsAppController);          // Start/resume WhatsApp client
router.get("/qr-code/:sessionId", ctrl.getQrController);             // Fetch QR for scanning
router.get("/status/:sessionId", ctrl.getStatusController);          // Poll for session link status
router.get("/session-by-user/:firebaseUid", getSessionByUserFirebaseId); // Get latest session for user

//  QR public link
router.get("/qr-link/:qrId", ctrl.getQrPublicController);            // Get QR link by ID (optional)

//  Session lifecycle
router.post("/end-session", ctrl.endSessionController);              // End a session

//  Subscriptions
router.post("/subscribe", ctrl.subscribeController);
router.post("/unsubscribe", ctrl.unsubscribeController);

//  Profile & contacts
router.get("/profile-pic/:sessionId/:phoneNumber", ctrl.getProfilePicController);
router.get("/in-contacts/:sessionId/:phoneNumber", ctrl.checkInContactsController);

//  Tracking
router.get("/history/:trackingId", ctrl.getHistoryController);
router.get("/last-seen/:phoneNumber", ctrl.getLastSeenController);

module.exports = router;
