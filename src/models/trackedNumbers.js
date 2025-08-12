const db = require('../config/database');

// Create trackedNumbers table if it doesn't exist
function createTrackedNumbersTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS trackedNumbers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                phoneNumber TEXT NOT NULL,
                status TEXT,
                lastSeen DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(id)
            )
        `, (err) => {
            if (err) return reject('Error creating trackedNumbers table');
            console.log('TrackedNumbers table created');
            resolve();
        });
    });
}

// Add a tracked phone number
function addTrackedNumber(userId, phoneNumber) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO trackedNumbers (userId, phoneNumber)
            VALUES (?, ?)
        `);
        stmt.run(userId, phoneNumber, function(err) {
            if (err) return reject('Error adding tracked number');
            resolve(this.lastID);  // Return the inserted tracked number's ID
        });
    });
}

// Get all tracked numbers for a user
function getTrackedNumbers(userId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM trackedNumbers WHERE userId = ?
        `, [userId], (err, rows) => {
            if (err) return reject('Error retrieving tracked numbers');
            resolve(rows);  // Return array of tracked numbers
        });
    });
}

module.exports = { createTrackedNumbersTable, addTrackedNumber, getTrackedNumbers };
