const dailyStatsModel = require('../models/dailyStatsModel');

async function addDailyStatsController(req, res) {
    const { trackingId, phoneNumber, date, totalOnlineTime, loginCount } = req.body;
    try {
        const id = await dailyStatsModel.addDailyStats(trackingId, phoneNumber, date, totalOnlineTime, loginCount);
        res.status(201).json({ message: 'Daily stats added', id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getDailyStatsByTrackingIdController(req, res) {
    const { trackingId } = req.params;
    try {
        const stats = await dailyStatsModel.getDailyStatsByTrackingId(trackingId);
        res.status(200).json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateDailyStatsController(req, res) {
    const { id } = req.params;
    const { totalOnlineTime, loginCount } = req.body;
    try {
        const changes = await dailyStatsModel.updateDailyStats(id, totalOnlineTime, loginCount);
        if (changes) {
            res.status(200).json({ message: 'Daily stats updated' });
        } else {
            res.status(404).json({ error: 'Daily stats not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteDailyStatsController(req, res) {
    const { id } = req.params;
    try {
        const changes = await dailyStatsModel.deleteDailyStats(id);
        if (changes) {
            res.status(200).json({ message: 'Daily stats deleted' });
        } else {
            res.status(404).json({ error: 'Daily stats not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    addDailyStatsController,
    getDailyStatsByTrackingIdController,
    updateDailyStatsController,
    deleteDailyStatsController
};