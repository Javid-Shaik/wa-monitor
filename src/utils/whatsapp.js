const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { logStatus } = require('../models/dailyStatsModel'); // We'll use the model to log status
const { addNotification } = require('../models/notifications');

let sock;
let trackedNumbers = new Set(); // Store phone numbers we are currently tracking

// Store the JIDs we have unsubscribed from to ignore their presence updates
const unsubscribedJids = new Set();

async function startWhatsAppClient() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("Generating QR code...");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startWhatsAppClient();
            }
        } else if (connection === "open") {
            console.log("WhatsApp Client Connected!");
            // Re-subscribe to all previously tracked numbers
            for (const number of trackedNumbers) {
                sub(number);
            }
        }
    });

    sock.ev.on("presence.update", async (presence) => {
        if (unsubscribedJids.has(presence.id)) {
            return;
        }

        const participant = presence.id.split("@")[0];
        const presenceData = presence.presences || {};

        for (const [jid, data] of Object.entries(presenceData)) {
            const status = data.lastKnownPresence || "unknown";
            
            if (status === "available") {
                // Log the status using the model
                logStatus(participant, "online");
                // TODO: Find a way to get userId and trackingId to add a notification
                // addNotification(userId, trackingId, participant, "online");
            } else if (status === "unavailable") {
                // Log the status using the model
                logStatus(participant, "offline");
                // TODO: Find a way to get userId and trackingId to add a notification
                // addNotification(userId, trackingId, participant, "offline");
            }
        }
    });
    return sock;
}

async function sub(phoneNumber) {
    if (!sock) return console.error("WhatsApp client is not initialized yet.");
    try {
        const jid = `${phoneNumber}@s.whatsapp.net`;
        await sock.presenceSubscribe(jid);
        trackedNumbers.add(phoneNumber); // Add to our list of tracked numbers
        console.log(`Successfully subscribed to ${phoneNumber}`);
    } catch (error) {
        console.error(`Error subscribing to presence updates for ${phoneNumber}:`, error);
    }
}

async function unsubscribeMultipleContacts(phoneNumbers) {
    for (const number of phoneNumbers) {
        const jid = number + "@s.whatsapp.net";
        try {
            await sock.presenceSubscribe(jid, false);
            unsubscribedJids.add(jid);
            trackedNumbers.delete(number); // Remove from our list of tracked numbers
            console.log(`Unsubscribed from presence updates for ${number}`);
        } catch (error) {
            console.error(`Error unsubscribing ${number}:`, error);
        }
    }
}

module.exports = {
    startWhatsAppClient,
    sub,
    unsubscribeMultipleContacts
};
