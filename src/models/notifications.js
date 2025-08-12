const db = require('../config/database');

function addNotification(userId, trackingId, phoneNumber, status) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO notifications (userId, trackingId, phoneNumber, status) VALUES (?, ?, ?, ?)`,
            [userId, trackingId, phoneNumber, status],
            function(err) {
                if (err) return reject(new Error('Error adding notification'));
                resolve(this.lastID);
            }
        );
    });
}

module.exports = { addNotification };