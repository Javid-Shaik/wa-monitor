const db = require('../config/database');
const crypto = require('crypto');
require('dotenv').config();

const ALGO = 'aes-256-gcm';
const KEY = process.env.AUTH_ENCRYPTION_KEY; // base64 32 bytes

if (!KEY) {
    console.warn('AUTH_ENCRYPTION_KEY not set — auth blobs will not be encrypted!');
}

/**
 * A replacer function for JSON.stringify that correctly serializes Buffer objects to a base64 string.
 * This is a direct implementation of Baileys's BufferJSON.replacer logic.
 * @param {string} key
 * @param {any} value
 * @returns {any}
 */
function bufferReplacer(key, value) {
    if (value instanceof Buffer || value instanceof Uint8Array) {
        return { type: 'Buffer', data: value.toString('base64') };
    }
    return value;
}

/**
 * A reviver function for JSON.parse that correctly revives Buffer objects from a base64 string.
 * This is a direct implementation of Baileys's BufferJSON.reviver logic.
 * @param {string} key
 * @param {any} value
 * @returns {any}
 */
function bufferReviver(key, value) {
    if (typeof value === 'object' && !!value && (value.buffer === true || value.type === 'Buffer')) {
        const val = value.data || value.value;
        return typeof val === 'string' ? Buffer.from(val, 'base64') : Buffer.from(val || []);
    }
    return value;
}

/**
 * Encrypts a JSON object into a base64 string, using a custom replacer to handle Buffers.
 * @param {object} plain The object to encrypt.
 * @returns {string} The base64-encoded encrypted blob.
 */
function encrypt(plain) {
    // Use the custom replacer to ensure Buffer objects are serialized correctly to base64.
    const serialized = JSON.stringify(plain, bufferReplacer);

    if (!KEY) {
        return Buffer.from(serialized).toString('base64');
    }

    const key = Buffer.from(KEY, 'base64');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: 16 });
    const enc = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypts a base64-encoded blob and restores the original object structure,
 * including Buffer objects, using a custom reviver.
 * @param {string} blobBase64 The base64-encoded encrypted blob.
 * @returns {object} The decrypted and deserialized object.
 */
function decrypt(blobBase64) {
    let decryptedString;
    if (!KEY) {
        decryptedString = Buffer.from(blobBase64, 'base64').toString('utf8');
    } else {
        const key = Buffer.from(KEY, 'base64');
        const raw = Buffer.from(blobBase64, 'base64');
        const iv = raw.slice(0, 12);
        const tag = raw.slice(12, 28);
        const ciphertext = raw.slice(28);
        const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
        decipher.setAuthTag(tag);
        const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        decryptedString = dec.toString('utf8');
    }

    // Use JSON.parse with your custom reviver function to restore Buffers from base64.
    return JSON.parse(decryptedString, bufferReviver);
}

function saveOrUpdateSession(sessionId, authJson, userId = null, status = 'LINKED') {
    const blob = encrypt(authJson);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO auth_sessions (sessionId, userId, auth_blob, status) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(sessionId) DO UPDATE SET
            auth_blob = excluded.auth_blob,
            userId = excluded.userId,
            status = excluded.status,
            updatedAt = CURRENT_TIMESTAMP
      `,
            [sessionId, userId, blob, status],
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

function getSession(sessionId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT sessionId, userId, auth_blob, status, createdAt, updatedAt FROM auth_sessions WHERE sessionId = ?`,
            [sessionId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                try {
                    const auth_json = row.auth_blob ? decrypt(row.auth_blob) : null;
                    resolve({
                        sessionId: row.sessionId,
                        userId: row.userId,
                        status: row.status,
                        auth: auth_json,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt,
                    });
                } catch (e) {
                    return reject(e);
                }
            }
        );
    });
}

function getLatestSessionByUserId(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT sessionId, userId, status, auth_blob, createdAt, updatedAt
            FROM auth_sessions
            WHERE userId = ?
            ORDER BY updatedAt DESC
            LIMIT 1`,
            [userId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve({
                    sessionId: row.sessionId,
                    userId: row.userId,
                    status: row.status,
                    auth: row.auth_blob ? decrypt(row.auth_blob) : null,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt
                });
            }
        );
    });
}

function getPendingSessionByUserId(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT sessionId, userId, status, auth_blob, createdAt, updatedAt
            FROM auth_sessions
            WHERE userId = ? AND status = 'PENDING'
            ORDER BY updatedAt DESC
            LIMIT 1`,
            [userId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve({
                    sessionId: row.sessionId,
                    userId: row.userId,
                    status: row.status,
                    auth: row.auth_blob ? decrypt(row.auth_blob) : null,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt
                });
            }
        );
    });
}

function getLinkedSessionByUserId(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT sessionId, userId, status, auth_blob, createdAt, updatedAt
            FROM auth_sessions
            WHERE userId = ? AND status = 'LINKED'
            ORDER BY updatedAt DESC
            LIMIT 1`,
            [userId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve({
                    sessionId: row.sessionId,
                    userId: row.userId,
                    status: row.status,
                    auth: row.auth_blob ? decrypt(row.auth_blob) : null,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt
                });
            }
        );
    });
}

function getAllSessions() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT sessionId, userId, auth_blob, status, createdAt, updatedAt FROM auth_sessions`, [], (err, rows) => {
            if (err) return reject(err);
            try {
                const result = rows.map(r => ({
                    sessionId: r.sessionId,
                    userId: r.userId,
                    status: r.status,
                    auth: r.auth_blob ? decrypt(r.auth_blob) : null,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt
                }));
                resolve(result);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM auth_sessions WHERE sessionId = ?`, [sessionId], function (err) {
            if (err) return reject(err);
            resolve(this.changes);
        });
    });
}

module.exports = {
    saveOrUpdateSession,
    getSession,
    getLatestSessionByUserId,
    getPendingSessionByUserId,
    getLinkedSessionByUserId,
    getAllSessions,
    deleteSession
};