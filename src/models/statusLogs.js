const db = require('../config/database');

// Create statusLog table if it doesn't exist
function createStatusLogsTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS statusLog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trackingId INTEGER NOT NULL,
                phoneNumber TEXT NOT NULL,
                status TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trackingId) REFERENCES trackedNumbers(id)
            )
        `, (err) => {
            if (err) return reject('Error creating statusLog table');
            console.log('statusLog table created');
            resolve();
        });
    });
}

// Add a status log for a tracked number
function addStatusLog(trackingId, phoneNumber, status) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO statusLog (trackingId, phoneNumber, status)
            VALUES (?, ?, ?)
        `);
        stmt.run(trackingId, phoneNumber, status, function(err) {
            if (err) return reject('Error adding status log');
            resolve(this.lastID);  // Return the inserted status log's ID
        });
    });
}

module.exports = { createStatusLogsTable, addStatusLog };
