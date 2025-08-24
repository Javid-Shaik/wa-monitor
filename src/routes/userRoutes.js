const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const auth = require('../middleware/firebaseAuth');

// Public (register after Firebase client sign-in)
router.post('/register', ctrl.createUser);

// Auth-required
router.post('/token/refresh', auth, ctrl.refreshToken);
router.post('/notify/test', auth, ctrl.sendTestNotification);

// Optional admin route
router.post('/notify/user/:userId', ctrl.sendToUserId);
router.get('/profile', auth, ctrl.getUser);


module.exports = router;
