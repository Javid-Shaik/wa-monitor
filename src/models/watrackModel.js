const db = require('../config/database');
const moment = require('moment');

function logStatus(trackingId, status) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    if (status === 'online') {
        db.run(
            'INSERT INTO statusLog (trackingId, onlineTime, offlineTime, duration) VALUES (?, ?, NULL, NULL)',
            [trackingId, timestamp],
            function (err) {
                if (err) console.error('Error logging online status:', err.message);
                else {
                    console.log(` Logged ONLINE for ${trackingId} at ${timestamp}`);
                }
            }
        );
    } else if (status === 'offline') {
        db.get(
            'SELECT id, onlineTime FROM statusLog WHERE trackingId = ? AND offlineTime IS NULL ORDER BY id DESC LIMIT 1',
            [trackingId],
            (err, row) => {
                if (err) return console.error('Error fetching online record:', err.message);
                if (row) {
                    const offlineTimestamp = moment().format("YYYY-MM-DD HH:mm:ss"); 
                    const duration = Math.floor((moment(timestamp) - moment(row.onlineTime)) / 1000);
                    db.run(
                        'UPDATE statusLog SET offlineTime = ?, duration = ? WHERE id = ?',
                        [timestamp, duration, row.id],
                        function (err) {
                            if (err) console.error('Error updating offline status:', err.message);
                            else {
                                console.log(
                                    ` Logged OFFLINE for ${trackingId} at ${offlineTimestamp} (Duration: ${formatDuration(duration)})`
                                );
                            }
                        }
                    );
                }
            }
        );
    }
}

function formatDuration(durationInSeconds) {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = durationInSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getHistory(trackingId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM statusLog WHERE trackingId = ? ORDER BY onlineTime DESC',
            [trackingId],
            (err, rows) => {
                if (err) return reject(new Error('Error retrieving history'));
                resolve(rows);
            }
        );
    });
}

function getLastSeen(trackingId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT offlineTime FROM statusLog WHERE trackingId = ? AND offlineTime IS NOT NULL ORDER BY offlineTime DESC LIMIT 1',
            [trackingId],
            (err, row) => {
                if (err) return reject(new Error('Error retrieving last seen time'));
                resolve(row ? row.offlineTime : null);
            }
        );
    });
}

module.exports = {
    logStatus,
    getHistory,
    getLastSeen,
};