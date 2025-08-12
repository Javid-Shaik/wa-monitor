const db = require('../config/database');

// Create users table if it doesn't exist
function createUserTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                subscriptionLimit INTEGER DEFAULT 10
            )
        `, (err) => {
            if (err) return reject('Error creating users table');
            console.log('Users table created');
            resolve();
        });
    });
}

// Add a new user to the users table
function addUser(email, subscriptionLimit = 10) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO users (email, subscriptionLimit)
            VALUES (?, ?)
        `);
        stmt.run(email, subscriptionLimit, function(err) {
            if (err) return reject('Error adding user');
            resolve(this.lastID);  // Return the inserted user's ID
        });
    });
}

// Get a user by ID
function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM users WHERE id = ?
        `, [userId], (err, row) => {
            if (err) return reject('Error retrieving user');
            resolve(row);  // Return user data
        });
    });
}

// Example: Update subscription limit for a user
function updateUserSubscription(userId, newLimit) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE users SET subscriptionLimit = ?
            WHERE id = ?
        `, [newLimit, userId], function(err) {
            if (err) return reject('Error updating user subscription');
            resolve(this.changes);  // Return number of updated rows
        });
    });
}

module.exports = { createUserTable, addUser, getUserById, updateUserSubscription };
