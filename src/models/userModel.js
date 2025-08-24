const db = require('../config/database');

/**
 * @function addOrUpdateUser
 * @description Inserts a new user or updates an existing one based on Firebase UID.
 * @param {string} firebaseUid - The Firebase user ID.
 * @param {string} email - The user's email.
 * @param {string} phoneNumber - The user's phone number.
 * @param {string} deviceToken - The user's device token for push notifications.
 * @param {number} subscriptionLimit - The limit for tracked numbers.
 * @returns {Promise<number>} A promise that resolves to the ID of the new user or the ID of the updated user.
 */
function addOrUpdateUser(firebaseUid, email, phoneNumber, deviceToken, subscriptionLimit = 10) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO user (firebaseUid, email, phoneNumber, deviceToken, subscriptionLimit)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(firebaseUid) DO UPDATE SET
            email = excluded.email,
            phoneNumber = excluded.phoneNumber,
            deviceToken = excluded.deviceToken,
            subscriptionLimit = excluded.subscriptionLimit
            RETURNING id;
        `;
        db.get(sql, [firebaseUid, email, phoneNumber, deviceToken, subscriptionLimit], (err, row) => {
            if (err) return reject(new Error('Error adding/updating user: ' + err.message));
            resolve(row.id);
        });
    });
}


/**
 * @function updateDeviceToken
 * @description Updates the device token for a user.
 * @param {string} firebaseUid - The Firebase user ID.
 * @param {string} deviceToken - The new device token.
 * @returns {Promise<boolean>} A promise that resolves to true if the token was updated, false otherwise.
 */
function updateDeviceToken(firebaseUid, deviceToken) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE user SET deviceToken = ? WHERE firebaseUid = ?`, [deviceToken, firebaseUid], function (err) {
            if (err) return reject(new Error('Error updating device token: ' + err.message));
            resolve(this.changes > 0);
        });
    });
}

/**
 * @function getUserById
 * @description Retrieves a user by their unique database ID.
 * @param {number} id - The user's unique database ID.
 * @returns {Promise<object|null>} A promise that resolves to the user object or null if not found.
 */
function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM user WHERE id = ?`, [id], (err, row) => {
            if (err) return reject(new Error('Error fetching user: ' + err.message));
            resolve(row || null);
        });
    });
}

/**
 * @function updateUserSubscription
 * @description Updates a user's subscription limit for tracked numbers.
 * @param {number} userId - The user's unique database ID.
 * @param {number} newLimit - The new subscription limit.
 * @returns {Promise<number>} A promise that resolves to the number of changes made.
 */
function updateUserSubscription(userId, newLimit) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE user SET subscriptionLimit = ? WHERE id = ?`,
            [newLimit, userId],
            function(err) {
                if (err) return reject(new Error('Error updating user subscription: ' + err.message));
                resolve(this.changes);
            }
        );
    });
}

/**
 * @function getUserIdByFirebaseUid
 * @description Retrieves a user's database ID using their Firebase UID.
 * @param {string} firebaseUid - The user's Firebase UID.
 * @returns {Promise<number|null>} A promise that resolves to the user's database ID or null if not found.
 */
function getUserIdByFirebaseUid(firebaseUid) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id AS userId FROM user WHERE firebaseUid = ?`,
            [firebaseUid],
            (err, row) => {
                if (err) return reject(new Error('Error fetching user by Firebase UID: ' + err.message));
                resolve(row ? row.userId : null);
            }
        );
    });
}

/**
 * @function deleteUser
 * @description Deletes a user and cascades the deletion to their tracked numbers, status logs, etc.
 * @param {string} firebaseUid - The user's Firebase UID.
 * @returns {Promise<number>} A promise that resolves to the number of changes made.
 */
function deleteUser(firebaseUid) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM user WHERE firebaseUid = ?`,
            [firebaseUid],
            function(err) {
                if (err) return reject(new Error('Error deleting user: ' + err.message));
                resolve(this.changes);
            }
        );
    });
}
async function updateUserPhoneBySession(sessionId, phoneNumber) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE user 
             SET phoneNumber = ? 
             WHERE id = (SELECT userId FROM auth_sessions WHERE sessionId = ?)`,
            [phoneNumber, sessionId],
            function (err) {
                if (err) {
                    return reject(new Error("DB error: " + err.message));
                }
                resolve(this.changes); // number of updated rows
            }
        );
    });
}

module.exports = { 
    addOrUpdateUser, 
    updateDeviceToken, 
    getUserById, 
    getUserIdByFirebaseUid,
    updateUserSubscription,
    deleteUser,
    updateUserPhoneBySession
};