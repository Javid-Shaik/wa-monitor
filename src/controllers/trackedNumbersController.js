const trackedNumbersModel = require('../models/trackedNumbersModel');

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

async function getTrackedNumbersController(req, res) {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    try {
        const numbers = await trackedNumbersModel.getTrackedNumbers(userId);
        res.status(200).json(numbers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
} 

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

