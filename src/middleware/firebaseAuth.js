const admin = require('../config/firebase');

async function firebaseAuth(req, res, next) {
  try {
    // Expect "Authorization: Bearer <idToken>"
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.firebase = { uid: decoded.uid, email: decoded.email || null, phone: decoded.phone_number || null };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}
module.exports = firebaseAuth;
