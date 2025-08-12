const db = require('../config/database');

// Create notifications table if it doesn't exist
function createNotificationsTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                trackingId INTEGER NOT NULL,
                phoneNumber TEXT NOT NULL,
                status TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                isRead BOOLEAN DEFAULT 0,
                FOREIGN KEY (userId) REFERENCES users(id),
                FOREIGN KEY (trackingId) REFERENCES trackedNumbers(id)
            )
        `, (err) => {
            if (err) return reject('Error creating notifications table');
            console.log('Notifications table created');
            resolve();
        });
    });
}

// Add a notification
function addNotification(userId, trackingId, phoneNumber, status) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO notifications (userId, trackingId, phoneNumber, status)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(userId, trackingId, phoneNumber, status, function(err) {
            if (err) return reject('Error adding notification');
            resolve(this.lastID);  // Return the inserted notification's ID
        });
    });
}

module.exports = { createNotificationsTable, addNotification };
