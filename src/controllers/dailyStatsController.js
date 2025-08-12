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
            console.error(err);
            return;
        });
        console.log('DailyStats table created');
        resolve();
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

// Get daily stats by tracking ID
function getDailyStatsByTrackingId(trackingId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM dailyStats WHERE trackingId = ?
        `, [trackingId], (err, rows) => {
            if (err) return reject('Error retrieving daily stats');
            resolve(rows);
        });
    });
}

// Update daily stats (e.g., total online time or login count)
function updateDailyStats(id, totalOnlineTime, loginCount) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE dailyStats 
            SET totalOnlineTime = ?, loginCount = ? 
            WHERE id = ?
        `, [totalOnlineTime, loginCount, id], function(err) {
            if (err) return reject('Error updating daily stats');
            resolve(this.changes);  // Number of updated rows
        });
    });
}

// Delete daily stats by ID
function deleteDailyStats(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM dailyStats WHERE id = ?`, [id], function(err) {
            if (err) return reject('Error deleting daily stats');
            resolve(this.changes); // Number of deleted rows
        });
    });
}

module.exports = {
    createDailyStatsTable,
    addDailyStats,
    getDailyStatsByTrackingId,
    updateDailyStats,
    deleteDailyStats
};
