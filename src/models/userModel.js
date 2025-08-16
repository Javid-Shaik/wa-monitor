const db = require('../config/database');

function addOrUpdateUser(firebaseUid, email, phoneNumber, deviceToken, subscriptionLimit = 10) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO user (firebaseUid, email, phoneNumber, deviceToken, subscriptionLimit)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(firebaseUid) DO UPDATE SET
        email = excluded.email,
        phoneNumber = excluded.phoneNumber,
        deviceToken = excluded.deviceToken,
        subscriptionLimit = excluded.subscriptionLimit
    `;
    db.run(sql, [firebaseUid, email, phoneNumber, deviceToken, subscriptionLimit], function (err) {
      if (err) return reject(new Error('Error adding/updating user: ' + err.message));
      resolve(this.lastID); // note: for updates lastID is undefined; caller usually doesn’t need it
    });
  });
}

function updateDeviceToken(firebaseUid, deviceToken) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE user SET deviceToken = ? WHERE firebaseUid = ?`, [deviceToken, firebaseUid], function (err) {
      if (err) return reject(new Error('Error updating device token: ' + err.message));
      resolve(this.changes > 0);
    });
  });
}

function getUserByFirebaseUid(firebaseUid) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM user WHERE firebaseUid = ?`, [firebaseUid], (err, row) => {
      if (err) return reject(new Error('Error fetching user: ' + err.message));
      resolve(row || null);
    });
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM user WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(new Error('Error fetching user: ' + err.message));
      resolve(row || null);
    });
  });
}

function updateUserSubscription(userId, newLimit) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE user SET subscriptionLimit = ? WHERE id = ?`,
            [newLimit, userId],
            function(err) {
                if (err) return reject(new Error('Error updating user subscription'));
                resolve(this.changes);
            }
        );
    });
}

module.exports = { addOrUpdateUser, updateDeviceToken, getUserByFirebaseUid, getUserById , updateUserSubscription };