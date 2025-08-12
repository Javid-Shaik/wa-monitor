const express = require('express');
const router = express.Router();
const dailyStatsController = require('../controllers/dailyStatsController');

router.post('/add', dailyStatsController.addDailyStatsController);
router.get('/:trackingId', dailyStatsController.getDailyStatsByTrackingIdController);
router.put('/update/:id', dailyStatsController.updateDailyStatsController);
router.delete('/delete/:id', dailyStatsController.deleteDailyStatsController);

module.exports = router;