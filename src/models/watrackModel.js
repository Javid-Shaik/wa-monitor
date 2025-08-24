const db = require('../config/database');
const moment = require('moment');

async function logStatus(trackingId, status) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    if (status === 'available') {
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
    } else if (status === 'unavailable') {
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

/**
 * @function getHistory
 * @description Retrieves the full online/offline history for a specific tracked number.
 * @param {number} trackingId - The ID of the tracked number.
 * @returns {Promise<Array>} A promise that resolves to an array of status log records.
 */
function getHistory(trackingId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM statusLog WHERE trackingId = ? ORDER BY onlineTime DESC',
            [trackingId],
            (err, rows) => {
                if (err) return reject(new Error('Error retrieving history: ' + err.message));
                resolve(rows);
            }
        );
    });
}

/**
 * @function getLastSeen
 * @description Retrieves the latest known status (online or offline) for a tracked number.
 * @param {number} trackingId - The ID of the tracked number.
 * @returns {Promise<object|null>} A promise that resolves to an object with the timestamp and status, or null if not found.
 */
async function getLastSeen(trackingId) {
    console.log('getLastSeen called with trackingId:', trackingId);
    return new Promise((resolve, reject) => {
        const query = `
            SELECT
                onlineTime AS timestamp,
                'online' AS status
            FROM statusLog
            WHERE trackingId = ? AND offlineTime IS NULL
            ORDER BY onlineTime DESC
            LIMIT 1;
        `;
        db.get(query, [trackingId], (err, row) => {
            if (err) {
                return reject(err);
            }
            // If no online status is found, check for the latest offline status
            if (row) {
                resolve(row);
            } else {
                const offlineQuery = `
                    SELECT
                        offlineTime AS timestamp,
                        'offline' AS status
                    FROM statusLog
                    WHERE trackingId = ? AND offlineTime IS NOT NULL
                    ORDER BY offlineTime DESC
                    LIMIT 1;
                `;
                db.get(offlineQuery, [trackingId], (err, offlineRow) => {
                    if (err) {
                        return reject(err);
                    }
                    if (offlineRow) {
                        resolve(offlineRow);
                    } else {
                        resolve(null); // No data found
                    }
                });
            }
        });
    });
}


module.exports = {
    logStatus,
    getHistory,
    getLastSeen,
};