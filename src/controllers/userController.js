const userModel = require('../models/userModel');

async function createUser(req, res) {
    const { email, subscriptionLimit } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        const userId = await userModel.addUser(email, subscriptionLimit || 10);
        res.status(201).json({ message: 'User created successfully', userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getUser(req, res) {
    const { id } = req.params;
    try {
        const user = await userModel.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateSubscription(req, res) {
    const { id } = req.params;
    const { subscriptionLimit } = req.body;
    if (!subscriptionLimit) {
        return res.status(400).json({ error: 'New subscription limit is required' });
    }
    try {
        const changes = await userModel.updateUserSubscription(id, subscriptionLimit);
        if (changes === 0) {
            return res.status(404).json({ error: 'User not found or no update made' });
        }
        res.json({ message: 'Subscription updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { createUser, getUser, updateSubscription };

