const db = require('../config/database');

async function createAllTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // USER TABLE — store auth provider details for Firebase login
            db.run(`
                CREATE TABLE IF NOT EXISTS user (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    firebaseUid TEXT UNIQUE, -- Firebase UID for authentication
                    email TEXT UNIQUE, -- Optional if phone-only login
                    phoneNumber TEXT UNIQUE, -- Optional if email-only login
                    deviceToken TEXT, -- For FCM push notifications
                    subscriptionLimit INTEGER DEFAULT 10,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating user table: ' + err.message));
                console.log('User table ready.');
            });

            // TRACKED NUMBER TABLE — unique per user
            db.run(`
                CREATE TABLE IF NOT EXISTS trackedNumber (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    phoneNumber TEXT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
                    UNIQUE (userId, phoneNumber)
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating trackedNumber table: ' + err.message));
                console.log('TrackedNumber table ready.');
            });

            // STATUS LOG — store online/offline events
            db.run(`
                CREATE TABLE IF NOT EXISTS statusLog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trackingId INTEGER NOT NULL,
                    onlineTime DATETIME NOT NULL,
                    offlineTime DATETIME,
                    duration INTEGER, -- Duration in seconds
                    FOREIGN KEY (trackingId) REFERENCES trackedNumber(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating statusLog table: ' + err.message));
                console.log('StatusLog table ready.');
            });

            // DAILY STATS — pre-aggregated stats for performance
            db.run(`
                CREATE TABLE IF NOT EXISTS dailyStats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trackingId INTEGER NOT NULL,
                    date DATE NOT NULL,
                    totalOnlineTime INTEGER DEFAULT 0, -- seconds
                    loginCount INTEGER DEFAULT 0,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumber(id) ON DELETE CASCADE,
                    UNIQUE (trackingId, date)
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating dailyStats table: ' + err.message));
                console.log('DailyStats table ready.');
            });

            // NOTIFICATIONS — store sent notifications
            db.run(`
                CREATE TABLE IF NOT EXISTS notification (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    trackingId INTEGER NOT NULL,
                    phoneNumber TEXT NOT NULL,
                    status TEXT, -- "online" / "offline" / etc
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isRead BOOLEAN DEFAULT 0,
                    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumber(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating notification table: ' + err.message));
                console.log('Notification table ready.');
            });

            // INDEXES for performance
            db.run(`CREATE INDEX IF NOT EXISTS idx_user_email ON user(email)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_user_phone ON user(phoneNumber)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_tracked_userId ON trackedNumber(userId)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_status_trackingId ON statusLog(trackingId)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_dailyStats_trackingId_date ON dailyStats(trackingId, date)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_notification_userId ON notification(userId)`);

            resolve();
        });
    });
}

module.exports = { createAllTables };
