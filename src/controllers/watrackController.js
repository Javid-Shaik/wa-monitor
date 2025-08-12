const { subscribe, isInContacts, getProfilePicture, unsubscribe, getContactDetails } = require('../utils/whatsapp');
const trackedNumbersModel = require('../models/trackedNumbersModel');
const trackerModel = require('../models/watrackModel');

async function subscribeController(req, res) {
    const { userId, phoneNumber } = req.body;
    if (!userId || !phoneNumber) {
        return res.status(400).json({ error: "User ID and phone number are required" });
    }
    try {
        const trackingId = await trackedNumbersModel.findOrCreateTrackedNumber(userId, phoneNumber);
        await subscribe(phoneNumber, userId, trackingId);
        getContactDetails(phoneNumber)
        res.json({ message: `Tracking started for ${phoneNumber}`, trackingId });
    } catch (error) {
        console.error("Error during subscription:", error);

        res.status(500).json({ error: "Failed to start tracking" });
    }
}

async function unsubscribeController(req, res) {
    const { phoneNumbers } = req.body;
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid phone numbers list" });
    }
    try {
        await unsubscribe(phoneNumbers);
        res.json({ success: true, message: "Unsubscribed successfully", phoneNumbers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error unsubscribing", error: error.message });
    }
}

async function getProfilePicController(req, res) {
    const { phoneNumber } = req.params;
    try {
        const profilePictureUrl = await getProfilePicture(phoneNumber);
        if (profilePictureUrl) {
            res.status(200).json({ profilePictureUrl });
        } else {
            res.status(404).json({ message: "Profile picture not found" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getHistoryController(req, res) {
    const trackingId = req.params.trackingId;
    try {
        const history = await trackerModel.getHistory(trackingId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getLastSeenController(req, res) {
    const  trackingId  = req.params.trackingId;
    console.log(`Fetching last seen for trackingId: ${trackingId}`);
    try {
        const lastSeen = await trackerModel.getLastSeen(trackingId);
        res.json({ lastSeen });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    subscribeController,
    unsubscribeController,
    getProfilePicController,
    getHistoryController,
    getLastSeenController
};