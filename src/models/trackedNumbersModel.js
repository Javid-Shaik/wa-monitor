const db = require('../config/database');

/**
 * @function findOrCreateTrackedNumber
 * @description Finds an existing tracked number by userId and phoneNumber, or creates a new one if it doesn't exist.
 * @param {number} userId - The unique ID of the user.
 * @param {string} phoneNumber - The phone number to track.
 * @returns {Promise<number>} A promise that resolves to the ID of the tracked number.
 */
async function findOrCreateTrackedNumber(userId, phoneNumber) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO trackedNumber (userId, phoneNumber)
            VALUES (?, ?)
            ON CONFLICT(userId, phoneNumber) DO UPDATE SET createdAt=createdAt -- Ensures nothing changes if conflict occurs
            RETURNING id;
        `;
        db.get(query, [userId, phoneNumber], function (err, row) {
            if (err) {
                return reject(new Error('Error finding or creating tracked number: ' + err.message));
            }
            // `row.id` will contain the ID of the existing or newly inserted row
            resolve(row.id);
        });
    });
}

/**
 * @function getTrackedNumbersByUserId
 * @description Retrieves all tracked numbers for a given user from the database.
 * @param {number} userId - The unique ID of the user.
 * @returns {Promise<Array>} A promise that resolves to an array of tracked number objects.
 */
async function getTrackedNumbersByUser(userId) {

    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                tn.id,
                tn.name,
                tn.profilePicUrl,
                tn.phoneNumber,
                tn.createdAt,
                sl.onlineTime,
                sl.offlineTime,
                CASE 
                    WHEN sl.offlineTime IS NULL AND sl.onlineTime IS NOT NULL THEN 1 
                    ELSE 0 
                END as isOnline,
                sl.duration
            FROM trackedNumber tn
            LEFT JOIN (
                SELECT 
                    trackingId,
                    onlineTime,
                    offlineTime,
                    duration,
                    ROW_NUMBER() OVER (PARTITION BY trackingId ORDER BY onlineTime DESC) as rn
                FROM statusLog
            ) sl ON tn.phoneNumber = sl.trackingId AND sl.rn = 1
            WHERE tn.userId = ?
            ORDER BY tn.createdAt DESC;
        `;
        db.all(query, [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function getTrackedPhoneNumbersByUser(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT phoneNumber from trackedNumber WHERE userId = ?
        `;
        db.all(query, [userId], (err, rows) => {
            if (err) return reject(new Error('Error retrieving tracked numbers: ' + err.message));
            resolve(rows.map(r => r.phoneNumber));
        });
    });
}

/**
 * @function getRecentActivityByUserId
 * @description Retrieves a list of recent online/offline events for a user's tracked numbers.
 * This is meant to populate the "Recent Activity" list on the dashboard.
 * @param {number} userId - The unique ID of the user.
 * @param {number} [limit=20] - The maximum number of recent activities to retrieve.
 * @returns {Promise<Array>} A promise that resolves to an array of activity log objects.
 */
async function getRecentActivityByUserId(userId, limit = 20) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT
                sl.onlineTime AS timestamp,
                sl.duration,
                tn.phoneNumber,
                'online' AS status
            FROM statusLog sl
            JOIN trackedNumber tn ON sl.trackingId = tn.id
            WHERE tn.userId = ?
            ORDER BY sl.onlineTime DESC
            LIMIT ?;
        `;
        db.all(query, [userId, limit], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}

function getTrackingIdByPhoneNumber(phoneNumber) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id FROM trackedNumber WHERE phoneNumber = ?`,
            [phoneNumber],
            (err, row) => {
                if (err) return reject(new Error('Error retrieving tracking ID'));
                resolve(row ? row.id : null);
            }
        );
    });
}

/**
 * @function deleteTrackedNumber
 * @description Deletes a tracked number and all associated status logs and daily stats.
 * @param {number} trackingId - The ID of the tracked number to delete.
 * @returns {Promise<number>} A promise that resolves to the number of changes made.
 */
function deleteTrackedNumber(trackingId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM trackedNumber WHERE id = ?`,
            [trackingId],
            function (err) {
                if (err) return reject(new Error('Error deleting tracked number: ' + err.message));
                resolve(this.changes);
            }
        );
    });
}

async function getSessionIdByUser(firebaseUid) {
    const query = `SELECT s.sessionId from auth_sessions s
                   JOIN user u ON s.userId = u.id   
                   WHERE u.firebaseUid = ?`;
    return new Promise((resolve, reject) => {
        db.get(query, [firebaseUid], (err, row) => {
            if (err) return reject(new Error('Error fetching session ID: ' + err.message));
            resolve(row ? row.sessionId : null);
        });
    });
}


module.exports = { 
    findOrCreateTrackedNumber, 
    getTrackedNumbersByUser,
    getTrackingIdByPhoneNumber,
    getSessionIdByUser,
    getTrackedPhoneNumbersByUser,
};

