const db = require('../config/database');

async function createAllTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create the user table
            db.run(`
                CREATE TABLE IF NOT EXISTS user (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    subscriptionLimit INTEGER DEFAULT 10
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating user table'));
                console.log('User table created or already exists.');
            });

            // Create the trackedNumber table with a UNIQUE constraint
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
                if (err) return reject(new Error('Error creating trackedNumber table'));
                console.log('TrackedNumber table created or already exists.');
            });

            // Create the statusLog table
            db.run(`
                CREATE TABLE IF NOT EXISTS statusLog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trackingId INTEGER NOT NULL,
                    onlineTime DATETIME,
                    offlineTime DATETIME,
                    duration INTEGER,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumber(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating statusLog table'));
                console.log("statusLog table created or already exists.");
            });

            // Create the dailyStats table
            db.run(`
                CREATE TABLE IF NOT EXISTS dailyStats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trackingId INTEGER NOT NULL,
                    date DATE NOT NULL,
                    totalOnlineTime INTEGER DEFAULT 0,
                    loginCount INTEGER DEFAULT 0,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumber(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating dailyStats table'));
                console.log('DailyStats table created or already exists.');
            });

            // Create the notification table
            db.run(`
                CREATE TABLE IF NOT EXISTS notification (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    trackingId INTEGER NOT NULL,
                    phoneNumber TEXT NOT NULL,
                    status TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isRead BOOLEAN DEFAULT 0,
                    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumber(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject(new Error('Error creating notification table'));
                console.log('Notification table created or already exists.');
            });

            resolve();
        });
    });
}

module.exports = { createAllTables };
