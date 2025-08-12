const db = require('../config/database');

function addUser(email, subscriptionLimit = 10) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO users (email, subscriptionLimit) VALUES (?, ?)`,
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
            `SELECT * FROM users WHERE id = ?`,
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
            `UPDATE users SET subscriptionLimit = ? WHERE id = ?`,
            [newLimit, userId],
            function(err) {
                if (err) return reject(new Error('Error updating user subscription'));
                resolve(this.changes);
            }
        );
    });
}

module.exports = { addUser, getUserById, updateUserSubscription };