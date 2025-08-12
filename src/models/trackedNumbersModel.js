const db = require('../config/database');

function findOrCreateTrackedNumber(userId, phoneNumber) {
    return new Promise((resolve, reject) => {
        // First, try to find an existing entry
        db.get(
            `SELECT id FROM trackedNumber WHERE userId = ? AND phoneNumber = ?`,
            [userId, phoneNumber],
            (err, row) => {
                if (err) {
                    return reject(new Error('Error checking for tracked number'));
                }
                
                if (row) {
                    // If an entry exists, return its ID
                    resolve(row.id);
                } else {
                    // If no entry exists, insert a new one
                    db.run(
                        `INSERT INTO trackedNumber (userId, phoneNumber) VALUES (?, ?)`,
                        [userId, phoneNumber],
                        function(insertErr) {
                            if (insertErr) {
                                return reject(new Error('Error adding new tracked number'));
                            }
                            resolve(this.lastID);
                        }
                    );
                }
            }
        );
    });
}

function getTrackedNumbers(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM trackedNumber WHERE userId = ?`,
            [userId],
            (err, rows) => {
                if (err) return reject(new Error('Error retrieving tracked numbers'));
                resolve(rows);
            }
        );
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


module.exports = { findOrCreateTrackedNumber, getTrackedNumbers, getTrackingIdByPhoneNumber };

