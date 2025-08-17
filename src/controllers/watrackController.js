const {
    initSession,
    endSession,
    subscribe,
    unsubscribe,
    getProfilePicture,
    getContactDetails,
    isInContacts,
    getQrDataFromCache,
    deleteQrDataFromCache
} = require('../utils/whatsapp');
const trackedNumbersModel = require('../models/trackedNumbersModel');
const trackerModel = require('../models/watrackModel');
const authSessionsModel = require('../models/authSessionsModel');
const crypto = require('crypto');

// Session Management
const statusCache = new Map(); // sessionId -> { connected: bool, status: 'PENDING'|'LINKED' }

function generateSessionId(userId) {
    return `${userId || 'anon'}_${crypto.randomBytes(6).toString('hex')}`;
}

async function createSessionController(req, res) {
    try {
        const { userId } = req.body; // optional
        const sessionId = generateSessionId(userId);
        await authSessionsModel.saveOrUpdateSession(sessionId, null, userId, 'PENDING');
        res.json({ sessionId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create session' });
    }
}

async function startWhatsAppController(req, res) {
    try {
        const { sessionId } = req.body;
        console.log(`Starting WhatsApp client for session: ${sessionId}`);
        if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

        statusCache.set(sessionId, { connected: false, status: 'PENDING' });

        // Load existing auth from DB if available
        const dbSession = await authSessionsModel.getSession(sessionId);
        const initialAuth = dbSession?.auth || null;
        const sessionMeta = { userId: dbSession?.userId || null };

        await initSession(
            sessionId,
            initialAuth,
            (qrLink) => {
                const currentStatus = statusCache.get(sessionId) || {};
                statusCache.set(sessionId, { ...currentStatus, qrLink });
            },
            async (creds) => {
                statusCache.set(sessionId, { connected: true, status: 'LINKED' });
                await authSessionsModel.saveOrUpdateSession(
                    sessionId,
                    creds,
                    sessionMeta.userId,
                    'LINKED'
                );
            },
            sessionMeta
        );

        res.json({ message: 'WhatsApp client starting' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
}

async function endSessionController(req, res) {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
    }
    try {
        await endSession(sessionId);
        res.json({ message: `Session ${sessionId} ended successfully.` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to end session' });
    }
}

function getQrController(req, res) {
    const { sessionId } = req.params;
    console.log(`Fetching QR for session: ${sessionId}`);
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });


    const sessionStatus = statusCache.get(sessionId);
    if (sessionStatus && sessionStatus.qrLink) {
        return res.json({ qr: sessionStatus.qrLink });
    }

    return res.status(202).json({ message: 'QR not ready' });
}

async function getStatusController(req, res) {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const cache = statusCache.get(sessionId) || { connected: false, status: 'PENDING' };
    const dbSession = await authSessionsModel.getSession(sessionId);

    res.json({
        linked: !!dbSession?.auth,
        status: cache.status || dbSession?.status || 'PENDING'
    });
}

async function getQrPublicController(req, res) {
    console.log(`Fetching public QR for session: ${req.params.qrId}`);
    const { qrId } = req.params;
    const qrDataUrl = getQrDataFromCache(qrId);

    if (qrDataUrl) {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center;">
                <img src="${qrDataUrl}" alt="WhatsApp QR Code">
                <p>Scan this QR code with WhatsApp on your phone.</p>
                <p>This link is only valid for a few seconds.</p>
            </div>
        `);
        // Optionally, delete the data from cache after it's been used
        deleteQrDataFromCache(qrId);
    } else {
        res.status(404).send('QR code expired or not found.');
    }
}

// Tracking Management
async function subscribeController(req, res) {
    const { sessionId, userId, phoneNumber } = req.body;
    if (!sessionId || !userId || !phoneNumber) {
        return res.status(400).json({ error: 'sessionId, userId and phoneNumber are required' });
    }

    try {
        const trackingId = await trackedNumbersModel.findOrCreateTrackedNumber(userId, phoneNumber);
        await subscribe(sessionId, phoneNumber, userId, trackingId);
        await getContactDetails(sessionId, phoneNumber);
        res.json({ message: `Tracking started for ${phoneNumber}`, trackingId });
    } catch (error) {
        console.error("Error during subscription:", error);
        res.status(500).json({ error: "Failed to start tracking" });
    }
}

async function unsubscribeController(req, res) {
    const { sessionId, phoneNumbers } = req.body;
    if (!sessionId || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return res.status(400).json({ success: false, message: "sessionId and valid phone numbers list required" });
    }

    try {
        await unsubscribe(sessionId, phoneNumbers);
        res.json({ success: true, message: "Unsubscribed successfully", phoneNumbers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error unsubscribing", error: error.message });
    }
}

// Contact Information
async function getProfilePicController(req, res) {
    const { sessionId, phoneNumber } = req.params;
    if (!sessionId || !phoneNumber) {
        return res.status(400).json({ error: 'sessionId and phoneNumber are required' });
    }

    try {
        const profilePictureUrl = await getProfilePicture(sessionId, phoneNumber);
        if (profilePictureUrl) {
            res.status(200).json({ profilePictureUrl });
        } else {
            res.status(404).json({ message: "Profile picture not found" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function checkInContactsController(req, res) {
    const { sessionId, phoneNumber } = req.params;
    if (!sessionId || !phoneNumber) {
        return res.status(400).json({ error: 'sessionId and phoneNumber are required' });
    }

    try {
        const exists = await isInContacts(sessionId, phoneNumber);
        res.json({ isInContacts: exists });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Tracking History
async function getHistoryController(req, res) {
    const { trackingId } = req.params;
    try {
        const history = await trackerModel.getHistory(trackingId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getLastSeenController(req, res) {
    const { trackingId } = req.params;
    console.log(`Fetching last seen for trackingId: ${trackingId}`);
    try {
        const lastSeen = await trackerModel.getLastSeen(trackingId);
        res.json({ lastSeen });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    // Session Management
    createSessionController,
    startWhatsAppController,
    getQrController,
    getStatusController,
    getQrPublicController,
    endSessionController,

    // Tracking Management
    subscribeController,
    unsubscribeController,

    // Contact Information
    getProfilePicController,
    checkInContactsController,

    // Tracking History
    getHistoryController,
    getLastSeenController
};