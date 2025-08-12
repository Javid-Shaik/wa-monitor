const db = require('../config/database');

function addUser(email, subscriptionLimit = 10) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO user (email, subscriptionLimit) VALUES (?, ?)`,
            [email, subscriptionLimit],
            function(err) {
                if (err) return reject(new Error('Error adding user'));
                resolve(this.lastID);
            }
        );
    });
}

function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM user WHERE id = ?`,
            [userId],
            (err, row) => {
                if (err) return reject(new Error('Error retrieving user'));
                resolve(row);
            }
        );
    });
}

function updateUserSubscription(userId, newLimit) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE user SET subscriptionLimit = ? WHERE id = ?`,
            [newLimit, userId],
            function(err) {
                if (err) return reject(new Error('Error updating user subscription'));
                resolve(this.changes);
            }
        );
    });
}

module.exports = { addUser, getUserById, updateUserSubscription };