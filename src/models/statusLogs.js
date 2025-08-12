const db = require('../config/database');

// Create statusLogs table if it doesn't exist
function createStatusLogsTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS statusLogs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trackingId INTEGER NOT NULL,
                phoneNumber TEXT NOT NULL,
                status TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trackingId) REFERENCES trackedNumbers(id)
            )
        `, (err) => {
            if (err) return reject('Error creating statusLogs table');
            console.log('StatusLogs table created');
            resolve();
        });
    });
}

// Add a status log for a tracked number
function addStatusLog(trackingId, phoneNumber, status) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO statusLogs (trackingId, phoneNumber, status)
            VALUES (?, ?, ?)
        `);
        stmt.run(trackingId, phoneNumber, status, function(err) {
            if (err) return reject('Error adding status log');
            resolve(this.lastID);  // Return the inserted status log's ID
        });
    });
}

module.exports = { createStatusLogsTable, addStatusLog };
