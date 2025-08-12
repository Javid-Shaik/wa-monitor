const db = require('../config/database');

async function createAllTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create the users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    subscriptionLimit INTEGER DEFAULT 10
                )
            `, (err) => {
                if (err) return reject('Error creating users table');
                console.log('Users table created or already exists.');
            });

            // Create the trackedNumbers table
            db.run(`
                CREATE TABLE IF NOT EXISTS trackedNumbers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    phoneNumber TEXT NOT NULL,
                    status TEXT,
                    lastSeen DATETIME,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject('Error creating trackedNumbers table');
                console.log('TrackedNumbers table created or already exists.');
            });

            // Create the user_status table
            db.run(`
                CREATE TABLE IF NOT EXISTS user_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone_number TEXT NOT NULL,
                    online_time DATETIME,
                    offline_time DATETIME,
                    duration INTEGER
                )
            `, (err) => {
                if (err) return reject('Error creating user_status table');
                console.log("user_status table created or already exists.");
            });

            // Create the dailyStats table
            db.run(`
                CREATE TABLE IF NOT EXISTS dailyStats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    trackingId INTEGER NOT NULL,
                    phoneNumber TEXT NOT NULL,
                    date DATE NOT NULL,
                    totalOnlineTime INTEGER DEFAULT 0,
                    loginCount INTEGER DEFAULT 0,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumbers(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject('Error creating dailyStats table');
                console.log('DailyStats table created or already exists.');
            });

            // Create the notifications table
            db.run(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    trackingId INTEGER NOT NULL,
                    phoneNumber TEXT NOT NULL,
                    status TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isRead BOOLEAN DEFAULT 0,
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (trackingId) REFERENCES trackedNumbers(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) return reject('Error creating notifications table');
                console.log('Notifications table created or already exists.');
            });

            resolve();
        });
    });
}

module.exports = { createAllTables };
