const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { logStatus } = require('../models/watrackModel'); // Corrected import to the new tracker model
const { addNotification } = require('../models/notificationsModel');
const { subscribe } = require("../routes/dailyStatsRoutes");

let sock;
// Use a Map to store phone numbers with their associated userId and trackingId
let trackedNumbers = new Map();



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
            for (const number of trackedNumbers.keys()) {
                const { userId, trackingId } = trackedNumbers.get(number);
                sub(number, userId, trackingId);
                console.log(`Re-subscribed to ${number} for userId: ${userId}, trackingId: ${trackingId}`);
            }
        }
    });

    sock.ev.on("presence.update", async (presence) => {
        console.log("Presence Update:", JSON.stringify(presence, null, 2));
        const participant = presence.id.split("@")[0]; // e.g., "1234567890@s.whatsapp.net" -> "1234567890"

        // Get the tracking data from our map
        const trackingData = trackedNumbers.get(participant);

        if (!trackingData) {
            console.log(`Presence update for non-tracked number: ${participant}. Ignoring.`);
            return;
        }
        
        const { userId, trackingId } = trackingData;
        const presenceData = presence.presences || {};

        for (const [jid, data] of Object.entries(presenceData)) {
            const status = data.lastKnownPresence || "unknown";
            const timestamp = formatTime(new Date().toISOString());
    
            console.log(`${participant} is now ${status} at ${timestamp}`);
    
            if (status === "available") {
                console.log(` ${participant} came online! Sending notification...`);
                //  Log status to SQLite
                logStatus(participant, "online");
    
                //  Send notification
                // await sendNotification(participant, "online");
            } else if (status === "unavailable") {
                console.log(` ${participant} went offline! Logging status...`);
                //  Log status to SQLite
                logStatus(participant, "offline");
    
                //  Send notification
                // await sendNotification(participant, "offline");
            }
            addNotification(userId, trackingId, participant, status);
        }
    });
    return sock;
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
}

async function sub(phoneNumber, userId, trackingId) {
    if (!sock) return console.error("WhatsApp client is not initialized yet.");
    try {
        const jid = `${phoneNumber}@s.whatsapp.net`;
        await sock.presenceSubscribe(jid);
        // Store the userId and trackingId along with the number
        trackedNumbers.set(phoneNumber, { userId, trackingId });
        console.log(`Successfully subscribed to presence updates for ${phoneNumber}`);
    } catch (error) {
        console.error(`Error subscribing to presence updates for ${phoneNumber}:`, error);
    }
}

async function unsubscribe(phoneNumbers) {
    if (!sock) return console.error("WhatsApp client is not initialized yet.");
    for (const number of phoneNumbers) {
        const jid = number + "@s.whatsapp.net";
        try {
            // Unsubscribe from presence updates
            await sock.presenceSubscribe(jid, false);
            // Remove from our list of tracked numbers
            trackedNumbers.delete(number);
            console.log(`Unsubscribed from presence updates for ${number}`);
        } catch (error) {
            console.error(`Error unsubscribing ${number}:`, error);
        }
    }
}


async function getContactDetails(phoneNumber) {
    const jid = phoneNumber + "@s.whatsapp.net";
    try {
        const contact = await sock.fetchStatus(jid); // Fetch profile details
        console.log(` Contact Info:`, contact);
    } catch (error) {
        console.error(` Error fetching contact:`, error);
    }
}

async function getContactList() {
    if (!sock) {
        console.error(" WhatsApp client is not initialized yet.");
        return;
    }

    try {
        sock.ev.on('contacts.upsert', (contacts) => {
            // Access the updated contact details within 'contacts' [2, 6, 11]
            console.log('Contact list updated:', contacts);
    
        });
        return contacts;
    } catch (error) {
        console.error(" Error fetching contacts:", error);
        return [];
    }
}

async function sendMessage(phoneNumber, message) {
    if (!sock) { //  Check if sock is initialized
        console.error(" WhatsApp client is not initialized yet.");
        return;
    }

    try {
        const jid = phoneNumber + "@s.whatsapp.net"; //  Format correctly
        await sock.sendMessage(jid, { text: message });
        console.log(` Message sent to ${phoneNumber}: ${message}`);
    } catch (error) {
        console.error(` Error sending message to ${phoneNumber}:`, error);
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

async function getProfilePicture(phoneNumber) {

    if (!sock) {
        console.error(" WhatsApp client is still not initialized.");
        return null;
    }

    try {
        const jid = phoneNumber + "@s.whatsapp.net"; // Format for WhatsApp
        const ppUrl = await sock.profilePictureUrl(jid, 'image'); // Get profile picture
        return ppUrl || "https://example.com/default-profile.png"; // Return default if no picture
    } catch (error) {
        console.error(` Error fetching profile picture for ${phoneNumber}:`, error);
        return "https://example.com/default-profile.png"; // Return default image on error
    }
}

// Function to fetch contacts and subscribe to presence updates
async function fetchAndSubscribeLimitedContacts(limit = 20) {
    if (!sock) {
        console.error(" WhatsApp client is not initialized.");
        return;
    }

    try {
        //  Get all contacts from WhatsApp
        const allContacts = await getContactList();

        console.log(allContacts);
        if (!allContacts || allContacts.length === 0) {
            console.log(" No contacts found.");
            return;
        }

        //  Select only the first `limit` contacts
        const selectedContacts = contacts.slice(0, limit);
        console.log(` Subscribing to presence updates for ${selectedContacts.length} contacts...`);

        for (const jid of selectedContacts) {
            console.log(`📡 Subscribing to ${jid}`);
            await sock.presenceSubscribe(jid);

            //  Add a small delay to prevent flooding WhatsApp servers
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(` Successfully subscribed to presence updates for ${selectedContacts.length} contacts.`);

    } catch (error) {
        console.error(" Error fetching contacts or subscribing:", error);
    }
}

//  Send Notification via Firebase Cloud Messaging (FCM)
async function sendNotification(phoneNumber, status) {
    try {
        const userDoc = await admin.firestore().collection("users").doc(phoneNumber).get();
        if (!userDoc.exists) {
            console.error(` No FCM token found for ${phoneNumber}`);
            return;
        }

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
            console.error(` User ${phoneNumber} has no FCM token.`);
            return;
        }

        const message = {
            notification: {
                title: "WhatsApp Status Update",
                body: `${phoneNumber} is ${status}`,
            },
            token: fcmToken,
        };

        await admin.messaging().send(message);
        console.log(` Notification sent for ${phoneNumber} (${status})`);
    } catch (error) {
        console.error(" Error sending notification:", error);
    }
}

module.exports = {
    startWhatsAppClient,
    subscribe: sub,
    getContactDetails,
    getContactList,
    sendMessage,
    isInContacts,
    getProfilePicture,
    unsubscribe,
};
