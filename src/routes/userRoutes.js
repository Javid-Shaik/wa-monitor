const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/add', userController.createUser);
router.get('/:id', userController.getUser);
router.put('/update/:id', userController.updateSubscription);

module.exports = router;
