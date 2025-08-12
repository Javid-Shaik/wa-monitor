const db = require('../config/database');

// Create dailyStats table if it doesn't exist
function createDailyStatsTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS dailyStats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trackingId INTEGER NOT NULL,
                phoneNumber TEXT NOT NULL,
                date DATE NOT NULL,
                totalOnlineTime INTEGER DEFAULT 0,
                loginCount INTEGER DEFAULT 0,
                FOREIGN KEY (trackingId) REFERENCES trackedNumbers(id)
            )
        `, (err) => {
            if (err) return reject('Error creating dailyStats table');
            console.log('DailyStats table created');
            resolve();
        });
    });
}

// Add daily stats for a tracked number
function addDailyStats(trackingId, phoneNumber, date, totalOnlineTime = 0, loginCount = 0) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO dailyStats (trackingId, phoneNumber, date, totalOnlineTime, loginCount)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(trackingId, phoneNumber, date, totalOnlineTime, loginCount, function(err) {
            if (err) return reject('Error adding daily stats');
            resolve(this.lastID);  // Return the inserted daily stats' ID
        });
    });
}

module.exports = { createDailyStatsTable, addDailyStats };
