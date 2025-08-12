// userController.js
const { addUser, getUserById, updateUserSubscription } = require('../models/userModel');

// Controller to add a new user
async function createUser(req, res) {
    const { email, subscriptionLimit } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        const userId = await addUser(email, subscriptionLimit || 10);
        res.status(201).json({ message: 'User created successfully', userId });
    } catch (error) {
        res.status(500).json({ error });
    }
}

// Controller to get user by ID
async function getUser(req, res) {
    const { id } = req.params;
    try {
        const user = await getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error });
    }
}

// Controller to update subscription limit
async function updateSubscription(req, res) {
    const { id } = req.params;
    const { subscriptionLimit } = req.body;
    if (!subscriptionLimit) {
        return res.status(400).json({ error: 'New subscription limit is required' });
    }
    try {
        const changes = await updateUserSubscription(id, subscriptionLimit);
        if (changes === 0) {
            return res.status(404).json({ error: 'User not found or no update made' });
        }
        res.json({ message: 'Subscription updated successfully' });
    } catch (error) {
        res.status(500).json({ error });
    }
}

module.exports = { createUser, getUser, updateSubscription };