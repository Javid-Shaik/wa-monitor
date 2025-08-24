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
const { getUserIdByFirebaseUid } = require('../models/userModel');

// Session Management
const statusCache = new Map(); // sessionId -> { connected: bool, status: 'PENDING'|'LINKED' }

function generateSessionId(userId) {
    return `${userId || 'anon'}_${crypto.randomBytes(6).toString('hex')}`;
}

async function createSessionController(req, res) {
    try {
        const { firebaseUid } = req.body;
        if (!firebaseUid) return res.status(400).json({ error: 'firebaseUid is required' });

        const userId = await getUserIdByFirebaseUid(firebaseUid); // <-- await
        if (!userId) return res.status(404).json({ error: 'user not found' });

        const sessionId = generateSessionId(userId);
        await authSessionsModel.saveOrUpdateSession(sessionId, null, userId, 'PENDING');
        res.json({ sessionId, status: 'PENDING' });
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

async function getSessionByUserController(req, res) {
    try {
        const { firebaseUid } = req.params;
        if (!firebaseUid) return res.status(400).json({ error: 'firebaseUid required' });

        const userId = await getUserIdByFirebaseUid(firebaseUid); // <-- await fixed
        if (!userId) return res.json(null);

        const latest = await authSessionsModel.getLatestSessionByUserId(userId);
        if (!latest) return res.json({ status: 'NONE' });

        return res.json({ sessionId: latest.sessionId, status: latest.status });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch user session' });
    }
}

async function ensureSessionController(req, res) {
    try {
        const { firebaseUid } = req.body;
        if (!firebaseUid) return res.status(400).json({ error: 'firebaseUid required' });

        const userId = await getUserIdByFirebaseUid(firebaseUid); // <-- await fixed
        if (!userId) return res.status(404).json({ error: 'user not found' });

        const linked = await authSessionsModel.getLinkedSessionByUserId(userId);
        if (linked) return res.json({ sessionId: linked.sessionId, status: 'LINKED' });

        let pending = await authSessionsModel.getPendingSessionByUserId(userId);
        if (pending) return res.json({ sessionId: pending.sessionId, status: 'PENDING' });

        const sessionId = generateSessionId(userId);
        await authSessionsModel.saveOrUpdateSession(sessionId, null, userId, 'PENDING');
        return res.json({ sessionId, status: 'PENDING' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to ensure session' });
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
        status: dbSession?.status || cache.status || 'PENDING'
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
        // deleteQrDataFromCache(qrId);
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
        await subscribe(sessionId, phoneNumber, userId);
        await getContactDetails(sessionId, phoneNumber);
        res.json({ message: `Tracking started for ${phoneNumber}`});
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
    const { phoneNumber } = req.params;
    console.log(`Fetching last seen for number: ${phoneNumber}`);
    try {
        const lastSeen = await trackerModel.getLastSeen(phoneNumber);
        res.json({ lastSeen });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}


/**
 * @api {get} /api/user/:firebaseUid/contacts Get Tracked Contacts
 * @apiDescription Fetches the list of contacts being tracked by a user.
 * This endpoint should be used by the mobile app to populate the main contact list.
 * @apiParam {String} firebaseUid The Firebase UID of the authenticated user.
 */
async function getTrackedContactsController(req, res) {
    try {
        const { firebaseUid } = req.params;
        if (!firebaseUid) {
            return res.status(400).json({ error: 'firebaseUid is required' });
        }

        const userId = await getUserIdByFirebaseUid(firebaseUid);
        if (!userId) {
            return res.status(404).json({ error: 'User not found' });
        }

        const contacts = await trackedNumbersModel.getTrackedNumbersByUserId(userId);
        const contactList = [];

        // Fetch additional details for each contact
        for (const contact of contacts) {
            const lastSeenData = await trackerModel.getLastSeen(contact.trackingId);
            const isOnline = lastSeenData && lastSeenData.status === 'online';
            const lastSeenTime = lastSeenData ? lastSeenData.timestamp : null;
            const avatarUrl = await getProfilePicture(contact.sessionId, contact.phoneNumber);

            contactList.push({
                phoneNumber: contact.phoneNumber,
                trackingId: contact.trackingId,
                lastSeen: lastSeenTime,
                isOnline: isOnline,
                avatarUrl: avatarUrl || null
            });
        }

        res.json(contactList);

    } catch (e) {
        console.error('Error fetching tracked contacts:', e);
        res.status(500).json({ error: e.message });
    }
}

/**
 * @api {get} /api/user/:firebaseUid/activity_logs Get User Activity Logs
 * @apiDescription Fetches a list of recent activity logs for all contacts a user is tracking.
 * This endpoint should be used to populate the "Recent Activity" list.
 * @apiParam {String} firebaseUid The Firebase UID of the authenticated user.
 */
async function getUserActivityLogsController(req, res) {
    try {
        const { firebaseUid } = req.params;
        if (!firebaseUid) {
            return res.status(400).json({ error: 'firebaseUid is required' });
        }

        const userId = await getUserIdByFirebaseUid(firebaseUid);
        if (!userId) {
            return res.status(404).json({ error: 'User not found' });
        }

        const activityLogs = await trackerModel.getRecentActivityByUserId(userId);
        res.json(activityLogs);
    } catch (e) {
        console.error('Error fetching user activity logs:', e);
        res.status(500).json({ error: e.message });
    }
}


module.exports = {
    // Session Management
    getSessionByUserController,   // GET /session/user/:firebaseUid
    ensureSessionController,      // POST /session/ensure
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
    getLastSeenController,

    getTrackedContactsController,
    getUserActivityLogsController
};