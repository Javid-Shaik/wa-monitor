const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    initAuthCreds,
    proto,
} = require("@whiskeysockets/baileys");
const qrcodeDataUrl = require('qrcode');
const { logStatus } = require('../models/watrackModel');
const { addNotification } = require('../models/notificationsModel');
const authSessionsModel = require('../models/authSessionsModel');
const trackedNumbersModel = require('../models/trackedNumbersModel');
const userModel = require('../models/userModel');
const crypto = require('crypto');
const fs = require('fs');

// Use a Map to store multiple sessions, keyed by sessionId
const sessions = new Map();
const QR_URL_BASE = process.env.QR_URL_BASE || 'http://localhost:3000/api/wa/qr-link/';

// In-memory cache for  data URLs
const qrDataUrlCache = new Map();

/**
 * A replacer function for JSON.stringify that correctly serializes Buffer objects to a base64 string.
 */
function bufferReplacer(key, value) {
    if (value instanceof Buffer || value instanceof Uint8Array) {
        return { type: 'Buffer', data: value.toString('base64') };
    }
    return value;
}

/**
 * A reviver function for JSON.parse that correctly revives Buffer objects from a base64 string.
 */
function bufferReviver(key, value) {
    if (typeof value === 'object' && !!value && (value.buffer === true || value.type === 'Buffer')) {
        const val = value.data || value.value;
        return typeof val === 'string' ? Buffer.from(val, 'base64') : Buffer.from(val || []);
    }
    return value;
}


/**
 * In-memory auth state. We can seed with client's auth JSON.
 */
function useInMemoryAuthState(initialAuthJson) {
    let creds = initialAuthJson?.creds
        ? JSON.parse(JSON.stringify(initialAuthJson.creds), bufferReviver)
        : initAuthCreds();

    // Key store (preKeys, sessions etc.)
    let keys = initialAuthJson?.keys
        ? JSON.parse(JSON.stringify(initialAuthJson.keys), bufferReviver)
        : {};

    const state = {
        creds,
        keys: {
            get: (type, ids) => {
                const data = {};
                for (const id of ids) {
                    data[id] = keys[type]?.[id] || null;
                }
                return data;
            },
            set: data => {
                for (const type in data) {
                    keys[type] = keys[type] || {};
                    Object.assign(keys[type], data[type]);
                }
            }
        }
    };

    const toJSON = () => ({
        creds: JSON.parse(JSON.stringify(state.creds, bufferReplacer)),
        keys: JSON.parse(JSON.stringify(keys, bufferReplacer))
    });

    const saveCreds = async () => {}; // no-op for in-memory, we'll push creds via callback

    return { state, saveCreds, toJSON };
}

/**
 * Starts a new WhatsApp client session or restores an existing one.
 * @param {string} sessionId The unique session ID for this client.
 * @param {object} initialAuthJson The initial authentication credentials to restore the session.
 * @param {function} onQr A callback function to receive the QR code data.
 * @param {function} onCreds A callback function to receive and save the updated credentials.
 * @param {object} sessionMeta Metadata related to the session (e.g., userId).
 */
async function initSession(sessionId, initialAuthJson, onQr, onCreds, sessionMeta = {}) {
    const existingSock = sessions.get(sessionId);

    if (existingSock) {
        if (existingSock.ws.readyState === existingSock.ws.OPEN) {
            console.log(`[WA:${sessionId}] Client is already connected. Skipping init.`);
            return existingSock;
        } else {
            console.log(`[WA:${sessionId}] Found a disconnected socket. Deleting from cache and re-initializing.`);
            sessions.delete(sessionId);
        }
    }

    let sock;
    let authState;
    let saveCreds;
    
    if (initialAuthJson) {
        console.log(`[WA:${sessionId}] Starting with in-memory auth state.`);
        const { state, toJSON } = useInMemoryAuthState(initialAuthJson);
        authState = state;
        sock = makeWASocket({
            auth: authState,
            printQRInTerminal: false,
        });

        sock.ev.on("creds.update", () => {
            const authJson = toJSON();
            if (onCreds) onCreds(authJson);
        });
    } else {
        console.log(`[WA:${sessionId}] Starting with multi-file auth state.`);
        const authDir = `auth_info/${sessionId}`;
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }
        const { state, saveCreds: saveMultiFileCreds } = await useMultiFileAuthState(authDir);
        authState = state;
        saveCreds = saveMultiFileCreds;
        
        sock = makeWASocket({
            auth: authState,
            printQRInTerminal: false,
        });

        sock.ev.on("creds.update", async () => {
            saveCreds();
            try {
                const fullAuth = {
                    creds: sock.authState.creds,
                    keys: sock.authState.keys
                };
                await authSessionsModel.saveOrUpdateSession(
                    sessionId,
                    fullAuth,
                    sessionMeta.userId || null,
                    'LINKED'
                );
                console.log(`[WA:${sessionId}] persisted auth state to DB`);
            } catch (e) {
                console.error(`[WA:${sessionId}] error persisting auth to DB`, e);
            }
        });
    }
    
    sessions.set(sessionId, sock);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && onQr) {
            const qrId = crypto.randomBytes(16).toString('hex');
            const qrLink = `${QR_URL_BASE}${qrId}`;
            const dataUrl = await qrcodeDataUrl.toDataURL(qr);
            qrDataUrlCache.set(qrId, dataUrl);
            onQr(qrLink);
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            sessions.delete(sessionId);
            
            if (shouldReconnect) {
                console.log(`[WA:${sessionId}] Connection closed, attempting reconnect...`);
                try {
                    const dbSession = await authSessionsModel.getSession(sessionId);
                    const newAuth = dbSession?.auth || null;
                    if (newAuth) {
                        await initSession(sessionId, newAuth, onQr, onCreds, sessionMeta);
                    } else {
                        console.log(`[WA:${sessionId}] No new credentials found. Not reconnecting.`);
                    }
                } catch (e) {
                    console.error(`[WA:${sessionId}] Failed to re-fetch auth data for reconnect:`, e);
                }
            } else {
                await cleanupSession(sessionId);
                console.log(`[WA:${sessionId}] Connection closed, not reconnecting.`);
            }
        } else if (connection === "open") {
            console.log(`[WA:${sessionId}] WhatsApp Client Connected!`);
            try {
                if (sock.user && sock.user.id) {
                    const jid = sock.user.id;
                    const phoneNumber = jid.split("@")[0].split(":")[0]; 
                    console.log(`[WA:${sessionId}] Logged in as: ${phoneNumber}`);

                    await userModel.updateUserPhoneBySession(sessionId, phoneNumber);
                    console.log(`[WA:${sessionId}] Phone number saved to DB: ${phoneNumber}`);
                }
                try {
                const dbSession = await authSessionsModel.getSession(sessionId);
                if (dbSession?.userId) {
                    const trackedNumbers = await trackedNumbersModel.getTrackedNumbersByUser(dbSession.userId);
                    sock.trackedNumbers = new Map();

                    for (const tn of trackedNumbers) {
                        try {
                            await subscribe(sessionId, tn.phoneNumber, dbSession.userId);
                            sock.trackedNumbers.set(tn.phoneNumber, {
                                userId: dbSession.userId,
                                trackingId: tn.id
                            });
                            console.log(`[WA:${sessionId}] Subscribed to ${tn.phoneNumber}`);
                        } catch (err) {
                            console.error(`[WA:${sessionId}] Failed subscribing to ${tn.phoneNumber}:`, err.message);
                        }
                    }
                }
            } catch (err) {
                console.error(`[WA:${sessionId}] Failed restoring subscriptions:`, err);
            }
            } catch (err) {
                console.error(`[WA:${sessionId}] Failed to save phone number:`, err);
            }
        }
    });

    sock.ev.on("presence.update", async (presence) => {
        const participant = presence.id.split("@")[0];
        const trackedData = sock.trackedNumbers?.get(participant);

        if (!trackedData) {
            console.log(`Presence update for non-tracked number: ${participant}. Ignoring.`);
            return;
        }

        const { userId, trackingId } = trackedData;
        const presenceData = presence.presences || {};

        for (const [jid, data] of Object.entries(presenceData)) {
            const status = data.lastKnownPresence || "unknown";
            console.log(`${participant} is now ${status}`);
            await logStatus(participant, status);
            await addNotification(userId, trackingId, participant, status);
        }
    });

    return sock;
}

// Public function to start a new session (for the API route)
async function startWhatsAppClient(sessionId, onQr, onCreds, sessionMeta = {}) {
    return initSession(sessionId, null, onQr, onCreds, sessionMeta);
}

// Helper functions to interact with the QR data cache
function getQrDataFromCache(qrId) {
    return qrDataUrlCache.get(qrId);
}

function deleteQrDataFromCache(qrId) {
    qrDataUrlCache.delete(qrId);
}

function getWhatsAppClient(sessionId) {
    return sessions.get(sessionId);
}

async function endSession(sessionId) {
    const sock = getWhatsAppClient(sessionId);
    if (sock) {
        // Unsubscribe from all tracked numbers before logging out
        const trackedNumbers = Array.from(sock.trackedNumbers?.keys() || []);
        if (trackedNumbers.length > 0) {
            await unsubscribe(sessionId, trackedNumbers);
        }
        
        await sock.logout();
        sessions.delete(sessionId);
        await authSessionsModel.deleteSession(sessionId);
        
        // Also remove the multi-file auth folder if it exists
        const authDir = `auth_info/${sessionId}`;
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
        }
        console.log(`[WA:${sessionId}] Session successfully terminated.`);
    } else {
        console.warn(`[WA:${sessionId}] No active session to terminate.`);
    }
}


async function subscribe(sessionId, phoneNumber, userId) {
    const sock = getWhatsAppClient(sessionId);
    if (!sock) {
        console.error("WhatsApp client is not initialized for this session.");
        return;
    }
    try {
        const trackingId = await trackedNumbersModel.findOrCreateTrackedNumber(userId, phoneNumber);
        const jidNumber = phoneNumber.startsWith("91") ? phoneNumber : "91" + phoneNumber;
        const jid = jidNumber + "@s.whatsapp.net";
        await sock.presenceSubscribe(jid);
        if (!sock.trackedNumbers) {
            sock.trackedNumbers = new Map();
        }
        sock.trackedNumbers.set(phoneNumber, { userId, trackingId });
        console.log(`Successfully subscribed to presence updates for ${phoneNumber} in session ${sessionId}`);
    } catch (error) {
        console.error(`Error subscribing to presence updates for ${phoneNumber}:`, error);
    }
}

async function unsubscribe(sessionId, phoneNumbers) {
    const sock = getWhatsAppClient(sessionId);
    if (!sock) {
        console.error("WhatsApp client is not initialized for this session.");
        return;
    }
    for (const number of phoneNumbers) {
        const jid = number + "@s.whatsapp.net";
        try {
            await sock.presenceSubscribe(jid, false);
            if (sock.trackedNumbers) {
                sock.trackedNumbers.delete(number);
            }
            console.log(`Unsubscribed from presence updates for ${number} in session ${sessionId}`);
        } catch (error) {
            console.error(`Error unsubscribing ${number}:`, error);
        }
    }
}

async function getContactDetails(sessionId, phoneNumber) {
    const sock = getWhatsAppClient(sessionId);
    if (!sock) return console.error("WhatsApp client is not initialized for this session.");
    const jid = phoneNumber + "@s.whatsapp.net";
    try {
        const contact = await sock.fetchStatus(jid);
        console.log(`Contact Info:`, contact);
    } catch (error) {
        console.error(`Error fetching contact:`, error);
    }
}

// Removed the getContactList, sendMessage, isInContacts, fetchAndSubscribeLimitedContacts functions as they were either incomplete, unused, or buggy in the original code.

async function getProfilePicture(sessionId, phoneNumber) {
    const sock = getWhatsAppClient(sessionId);
    if (!sock) {
        console.error("WhatsApp client is not initialized for this session.");
        return null;
    }

    try {
        const jidNumber = phoneNumber.startsWith("91") ? phoneNumber : "91" + phoneNumber;
        const jid = jidNumber + "@s.whatsapp.net";
        console.log(`Fetching profile picture for ${jid}`);
        const ppUrl = await sock.profilePictureUrl(jid, 'image');
        return ppUrl;
    } catch (error) {
        console.error(`Error fetching profile picture for ${phoneNumber}:`, error);
        return "https://example.com/default-profile.png";
    }
}

async function isInContacts(phoneNumber) {
    if (!sock) {
        console.error(" WhatsApp client is not initialized.");
        return false;
    }

    const jid = phoneNumber + "@s.whatsapp.net";
    
    if (sock.store && sock.store.contacts) {
        const contacts = sock.store.contacts;
        return Object.keys(contacts).includes(jid);
    } else {
        console.log(" No contacts found in store.");
        return false;
    }
}

async function cleanupSession(sessionId) {
    try {
        await authSessionsModel.deleteSession(sessionId);

        if (fs.existsSync(`auth_info/${sessionId}`)) {
            fs.rmSync(`auth_info/${sessionId}`, { recursive: true, force: true });
            console.log(`[WA:${sessionId}] Deleted auth_info folder`);
        }

        console.log(`[WA:${sessionId}] Session cleaned up from DB & file system`);
    } catch (err) {
        console.error(`[WA:${sessionId}] Cleanup error:`, err);
    }
}


module.exports = {
    initSession,
    startWhatsAppClient,
    endSession,
    getWhatsAppClient,
    subscribe,
    unsubscribe,
    getContactDetails,
    getProfilePicture,
    getQrDataFromCache,
    deleteQrDataFromCache,
    isInContacts,
};