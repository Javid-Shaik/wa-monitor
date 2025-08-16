const admin = require('../config/firebase');
const userModel = require('../models/userModel');

async function createUser(req, res) {
    const { idToken, deviceToken, subscriptionLimit } = req.body;
    console.log('Creating user with data:', { idToken, deviceToken, subscriptionLimit });

    if (!idToken || !deviceToken) {
        return res.status(400).json({ error: 'idToken and deviceToken are required' });
    }

    try {
        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email || null;
        const phoneNumber = decodedToken.phone_number || null;

        // Add or update user in DB
        const userId = await userModel.addOrUpdateUser(
            firebaseUid,
            email,
            phoneNumber,
            deviceToken,
            subscriptionLimit || 10
        );

        res.status(201).json({
            message: 'User registered successfully',
            userId,
            firebaseUid
        });

    } catch (error) {
        console.error('Error verifying Firebase token:', error);
        res.status(401).json({ error: 'Invalid Firebase token' });
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

async function refreshToken(req, res) {
  const { deviceToken } = req.body;
  if (!deviceToken) return res.status(400).json({ error: 'deviceToken is required' });

  try {
    const firebaseUid = req.firebase.uid; // from middleware
    await userModel.updateDeviceToken(firebaseUid, deviceToken);
    return res.json({ message: 'Device token updated' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function sendTestNotification(req, res) {
  try {
    const firebaseUid = req.firebase.uid;
    const user = await userModel.getUserByFirebaseUid(firebaseUid);
    if (!user || !user.deviceToken) return res.status(404).json({ error: 'No device token found' });

    const message = {
      token: user.deviceToken,
      notification: { title: 'Hello from WaTrack 👋', body: 'Your push setup works perfectly!' },
      data: { screen: 'home' },
    };
    const response = await admin.messaging().send(message);
    return res.json({ message: 'Notification sent', response });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Optional: admin-only direct send
async function sendToUserId(req, res) {
  try {

    const { userId } = req.params;
    const { title, body, data } = req.body;
    const user = await userModel.getUserById(userId);
    if (!user || !user.deviceToken) return res.status(404).json({ error: 'User/device not found' });

    const message = {
      token: user.deviceToken,
      notification: { title: title || 'Message', body: body || '' },
      data: data || {},
    };
    const response = await admin.messaging().send(message);
    return res.json({ message: 'Sent', response });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

module.exports = { createUser, getUser, updateSubscription,refreshToken, sendTestNotification, sendToUserId };

