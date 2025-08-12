const express = require('express');
const router = express.Router();
const {
    addDailyStats,
    getDailyStatsByTrackingId,
    updateDailyStats,
    deleteDailyStats
} = require('../controllers/dailyStatsController');

// Route to add daily stats
router.post('/add', async (req, res) => {
    const { trackingId, phoneNumber, date, totalOnlineTime, loginCount } = req.body;
    try {
        const id = await addDailyStats(trackingId, phoneNumber, date, totalOnlineTime, loginCount);
        res.status(201).json({ message: 'Daily stats added', id });
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Route to get daily stats by tracking ID
router.get('/:trackingId', async (req, res) => {
    const { trackingId } = req.params;
    try {
        const stats = await getDailyStatsByTrackingId(trackingId);
        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Route to update daily stats
router.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    const { totalOnlineTime, loginCount } = req.body;
    try {
        const changes = await updateDailyStats(id, totalOnlineTime, loginCount);
        if (changes) {
            res.status(200).json({ message: 'Daily stats updated' });
        } else {
            res.status(404).json({ error: 'Daily stats not found' });
        }
    } catch (error) {
        res.status(500).json({ error });
    }
});

// Route to delete daily stats
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const changes = await deleteDailyStats(id);
        if (changes) {
            res.status(200).json({ message: 'Daily stats deleted' });
        } else {
            res.status(404).json({ error: 'Daily stats not found' });
        }
    } catch (error) {
        res.status(500).json({ error });
    }
});

module.exports = router;
