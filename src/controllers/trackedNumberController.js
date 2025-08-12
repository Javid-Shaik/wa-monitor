const { addTrackedNumber, getTrackedNumbers } = require('../models/trackedNumberModel');

// Controller to add a tracked phone number
async function addTrackedNumberController(req, res) {
    const { userId, phoneNumber } = req.body;
    if (!userId || !phoneNumber) {
        return res.status(400).json({ error: 'User ID and phone number are required' });
    }

    try {
        const id = await addTrackedNumber(userId, phoneNumber);
        res.status(201).json({ message: 'Tracked number added successfully', id });
    } catch (error) {
        res.status(500).json({ error });
    }
}

// Controller to get all tracked numbers for a user
async function getTrackedNumbersController(req, res) {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const numbers = await getTrackedNumbers(userId);
        res.status(200).json(numbers);
    } catch (error) {
        res.status(500).json({ error });
    }
}

module.exports = { addTrackedNumberController, getTrackedNumbersController };
