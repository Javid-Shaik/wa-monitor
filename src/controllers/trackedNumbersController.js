const trackedNumbersModel = require('../models/trackedNumbersModel');
const { getUserIdByFirebaseUid } = require('../models/userModel');
const { formatLastSeen, formatDuration } = require('../utils/formatUtils');
const { getProfilePicture } = require('../utils/whatsapp');

async function addTrackedNumberController(req, res) {
    const { userId, phoneNumber } = req.body;
    if (!userId || !phoneNumber) {
        return res.status(400).json({ error: 'User ID and phone number are required' });
    }
    try {
        const id = await trackedNumbersModel.findOrCreateTrackedNumber(userId, phoneNumber);
        res.status(201).json({ message: 'Tracked number added successfully', id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const getTrackedNumbersController = async (req, res) => {
    try {
        const { firebaseUid } = req.params;

        if (!firebaseUid) {
            return res.status(404).json({ error: "User not found" });
        }

        const userId = await getUserIdByFirebaseUid(firebaseUid);

        // Step 1: fetch tracked numbers from DB
        const sessionId = await trackedNumbersModel.getSessionIdByUser(firebaseUid);
        if (!sessionId) {
            return res.status(404).json({ error: "No session found for user" });
        }
        const rows = await trackedNumbersModel.getTrackedNumbersByUser(userId);

        // Step 2: async map → fetch profile pics for each number
        const contacts = await Promise.all(
            rows.map(async (row) => {
                const profilePicUrl = await getProfilePicture(sessionId, row.phoneNumber); 
                return {
                    name: row.name || row.phoneNumber,
                    avatarResId: null,
                    profilePicUrl,
                    phoneNumber: row.phoneNumber,
                    lastSeen: formatLastSeen(row.offlineTime),
                    isOnline: row.isOnline === 1,
                    duration: formatDuration(row.duration)
                };
            })
        );

        res.json({
            contacts,
            count: contacts.length
        });

    } catch (error) {
        console.error("Error in getTrackedNumbersController:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

async function getLastSeen(req, res) {
    const phoneNumber = req.params.phoneNumber;

    db.get(
        "SELECT offline_time FROM user_status WHERE phone_number = ? ORDER BY offline_time DESC LIMIT 1",
        [phoneNumber],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (!row || !row.offline_time) {
                res.status(404).json({ message: "No last seen data found" });
            } else {
                res.json({ phoneNumber, lastSeen: row.offline_time });
            }
        }
    );
}

module.exports = { addTrackedNumberController, getTrackedNumbersController, getLastSeen};

