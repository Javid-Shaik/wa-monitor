const db = require('../config/database');

function addTrackedNumber(userId, phoneNumber) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO trackedNumbers (userId, phoneNumber) VALUES (?, ?)`,
            [userId, phoneNumber],
            function(err) {
                if (err) return reject(new Error('Error adding tracked number'));
                resolve(this.lastID);
            }
        );
    });
}

function getTrackedNumbers(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM trackedNumbers WHERE userId = ?`,
            [userId],
            (err, rows) => {
                if (err) return reject(new Error('Error retrieving tracked numbers'));
                resolve(rows);
            }
        );
    });
}

module.exports = { addTrackedNumber, getTrackedNumbers };
