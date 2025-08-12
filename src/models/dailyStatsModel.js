const db = require('../config/database');

function addDailyStats(trackingId, phoneNumber, date, totalOnlineTime = 0, loginCount = 0) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO dailyStats (trackingId, phoneNumber, date, totalOnlineTime, loginCount) VALUES (?, ?, ?, ?, ?)`,
            [trackingId, phoneNumber, date, totalOnlineTime, loginCount],
            function(err) {
                if (err) return reject(new Error('Error adding daily stats'));
                resolve(this.lastID);
            }
        );
    });
}

function getDailyStatsByTrackingId(trackingId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM dailyStats WHERE trackingId = ?`,
            [trackingId],
            (err, rows) => {
                if (err) return reject(new Error('Error retrieving daily stats'));
                resolve(rows);
            }
        );
    });
}

function updateDailyStats(id, totalOnlineTime, loginCount) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE dailyStats SET totalOnlineTime = ?, loginCount = ? WHERE id = ?`,
            [totalOnlineTime, loginCount, id],
            function(err) {
                if (err) return reject(new Error('Error updating daily stats'));
                resolve(this.changes);
            }
        );
    });
}

function deleteDailyStats(id) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM dailyStats WHERE id = ?`,
            [id],
            function(err) {
                if (err) return reject(new Error('Error deleting daily stats'));
                resolve(this.changes);
            }
        );
    });
}

module.exports = {
    addDailyStats,
    getDailyStatsByTrackingId,
    updateDailyStats,
    deleteDailyStats
};