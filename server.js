const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const express = require("express");
const admin = require("firebase-admin");
const sqlite3 = require("sqlite3").verbose();
const dotenv = require("dotenv");

dotenv.config();

let sock;

//  Initialize Firebase Admin SDK
const serviceAccount = require("./firebase-key.json"); // 🔹 Path to your Firebase service key
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});


//  Initialize SQLite Database
const db = new sqlite3.Database("./database.sqlite");
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS user_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL,
            online_time DATETIME,
            offline_time DATETIME,
            duration INTEGER
        )
    `);
});

//  Store the tracked number
let trackedNumber = null;
let contacts = new Set();

//  Initialize Baileys WhatsApp Client
async function startWhatsAppClient() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info"); // 🔹 Saves session

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, //  Set this to false to handle QR code manually
    });

    sock.ev.on("creds.update", saveCreds);

    //  Handle Disconnection & QR Code
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(" Connection Update:", update);

        if (qr) {
            console.log("Generating QR code...");
            qrcode.generate(qr, { small: true }); //  Explicitly generate the QR code
        }
        
        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(" Connection closed. Reconnecting...", shouldReconnect);
            if (shouldReconnect) {
                startWhatsAppClient();
            }
        } else if (connection === "open") {
            console.log(" WhatsApp Client Connected!");
            
            //  Re-subscribe to presence updates when reconnected
            if (trackedNumber) {
                console.log(`📡 Re-subscribing to ${trackedNumber}...`);
                await sub(trackedNumber);
            }
        }
    });

    sock.ev.on('contacts.upsert', (contacts) => {

        console.log('Contact list updated:', contacts);

    });

    sock.ev.on("presence.update", async (presence) => {
        if (unsubscribedJids.has(presence.id)) {
            console.log(`Ignoring presence update for unsubscribed number: ${presence.id}`);
            return; // Exit the function
        }
        console.log(" Presence Update:", JSON.stringify(presence, null, 2));
    
        const participant = presence.id.split("@")[0]; // Extract phone number
        const presenceData = presence.presences || {}; // Ensure presences exist
    
        // Loop through presence data for the user
        for (const [jid, data] of Object.entries(presenceData)) {
            const status = data.lastKnownPresence || "unknown"; // Available or unavailable
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
        }
    });    

    sock.ev.on('messaging-history.set', async (data) => {
        console.log("📜 Messaging history set:", data);
        if (!data.contacts || data.contacts.length === 0) {
            console.log(" No contacts found in messaging history.");
            return;
        }
    
        const filteredContacts = data.contacts.filter((item) =>
            item.id.endsWith("@s.whatsapp.net")
        );
    
        console.log(" Contacts from messaging history:", filteredContacts);
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


async function sub(trackedNumber) {
    if (!sock) {
        console.error(" WhatsApp client is not initialized yet.");
        return;
    }

    try {
        const jid = `${trackedNumber}@s.whatsapp.net`;
        console.log(`Subscribing to presence updates for ${jid}...`);
        
        await sock.presenceSubscribe(jid);
        console.log(` Successfully subscribed to ${trackedNumber}`);
    } catch (error) {
        console.error(`Error subscribing to presence updates for ${trackedNumber}:`, error);
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

const onlineContacts = new Set(); // Store online contacts in memory

// Function to fetch contacts and subscribe to presence updates
async function fetchAndSubscribeLimitedContacts(limit = 20) {
    if (!sock) {
        console.error(" WhatsApp client is not initialized.");
        return;
    }

    try {
        // 🔹 Get all contacts from WhatsApp
        const allContacts = await getContactList();

        console.log(allContacts);
        if (!allContacts || allContacts.length === 0) {
            console.log(" No contacts found.");
            return;
        }

        // 🔹 Select only the first `limit` contacts
        const selectedContacts = contacts.slice(0, limit);
        console.log(` Subscribing to presence updates for ${selectedContacts.length} contacts...`);

        for (const jid of selectedContacts) {
            console.log(`📡 Subscribing to ${jid}`);
            await sock.presenceSubscribe(jid);

            // 🔹 Add a small delay to prevent flooding WhatsApp servers
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(` Successfully subscribed to presence updates for ${selectedContacts.length} contacts.`);

    } catch (error) {
        console.error(" Error fetching contacts or subscribing:", error);
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

const moment = require("moment"); //  Install via npm: npm install moment

//  Function to Log Status to SQLite
function logStatus(phoneNumber, status) {
    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss"); // Format: 2025-02-15 14:30:45

    if (status === "online") {
        db.run(
            "INSERT INTO user_status (phone_number, online_time, offline_time, duration) VALUES (?, ?, NULL, NULL)",
            [phoneNumber, timestamp],
            function (err) {
                if (err) {
                    console.error(" Error logging online status:", err.message);
                } else {
                    console.log(` Logged ONLINE for ${phoneNumber} at ${timestamp}`);
                }
            }
        );
    } else if (status === "offline") {
        db.get(
            "SELECT id, online_time FROM user_status WHERE phone_number = ? AND offline_time IS NULL ORDER BY id DESC LIMIT 1",
            [phoneNumber],
            (err, row) => {
                if (err) {
                    console.error(" Error fetching online record:", err.message);
                    return;
                }
                if (row) {
                    const offlineTimestamp = moment().format("YYYY-MM-DD HH:mm:ss"); // Human-readable format
                    const duration = Math.floor((moment(offlineTimestamp, "YYYY-MM-DD HH:mm:ss") - moment(row.online_time, "YYYY-MM-DD HH:mm:ss")) / 1000); // Duration in seconds

                    db.run(
                        "UPDATE user_status SET offline_time = ?, duration = ? WHERE id = ?",
                        [offlineTimestamp, duration, row.id],
                        function (err) {
                            if (err) {
                                console.error(" Error updating offline status:", err.message);
                            } else {
                                console.log(
                                    ` Logged OFFLINE for ${phoneNumber} at ${offlineTimestamp} (Duration: ${formatDuration(duration)})`
                                );
                            }
                        }
                    );
                }
            }
        );
    }
}

//  Helper function to format duration (HH:MM:SS)
function formatDuration(durationInSeconds) {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = durationInSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

async function syncContacts() {
    if (!sock) {
        console.error(" WhatsApp client is not initialized.");
        return;
    }

    // try {
    //     const contacts = await sock.ev.
    //     console.log("📜 Synced Contacts:", contacts);
    // } catch (error) {
    //     console.error(" Error fetching contacts:", error);
    // }
}

// Run this after connecting Baileys



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
const unsubscribedJids = new Set();

async function unsubscribeMultipleContacts(phoneNumbers) {
    for (const number of phoneNumbers) {
        const jid = number + "@s.whatsapp.net";
        
        try {
            await sock.presenceSubscribe(jid, false); // Unsubscribe
            unsubscribedJids.add(jid);
            console.log(`Unsubscribed from presence updates for ${number}`);
        } catch (error) {
            console.error(`Error unsubscribing ${number}:`, error);
        }
    }
}


//  Express API Setup
const app = express();
app.use(express.json());

//  API Endpoint to Set Tracked Number
app.post("/track", async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    trackedNumber = phoneNumber;
    console.log(` Now tracking: ${trackedNumber}`);
    sub(trackedNumber);
    const allContacts = await getContactList();
    console.log(allContacts);
    isInContacts(`91${trackedNumber}`).then(isContact => {
        console.log(isContact ? " Alpha is in your contacts" : " Alpha is NOT in your contacts");
    });
    // sendMessage(trackedNumber, "You are being tracked!");
     // Example usage
    getContactDetails(`${trackedNumber}`);

    res.json({ message: `Tracking started for ${trackedNumber}` });
});

//  API Endpoint to Get Complete Status History
app.get("/history/:phoneNumber", (req, res) => {
    const phoneNumber = req.params.phoneNumber;

    db.all(
        "SELECT * FROM user_status WHERE phone_number = ? ORDER BY online_time DESC",
        [phoneNumber],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (rows.length === 0) {
                res.status(404).json({ message: "No data found for this number" });
            } else {
                res.json(rows);
            }
        }
    );
});

//  API Endpoint to Get Last Seen
app.get("/lastseen/:phoneNumber", (req, res) => {
    const phoneNumber = req.params.phoneNumber;

    db.get(
        "SELECT offline_time FROM user_status WHERE phone_number = ? ORDER BY offline_time DESC LIMIT 1",
        [phoneNumber],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (!row || !row.offline_time) {
                res.status(404).json({ message: "No last seen data found" });
            } else {
                res.json({ phoneNumber, lastSeen: row.offline_time });
            }
        }
    );
});

app.get("/profile-picture/:phoneNumber", async (req, res) => {
    const phoneNumber = req.params.phoneNumber;
    
    const profilePicture = await getProfilePicture(phoneNumber);

    if (profilePicture) {
        res.json({ phoneNumber, profilePicture });
    } else {
        res.status(404).json({ error: "Profile picture not found" });
    }
});

app.get("/online-contacts", (req, res) => {

    if (onlineContacts.size === 0) {
        return res.json({ message: "No contacts are currently online." });
    }
    res.json({ onlineContacts: Array.from(onlineContacts) });
});

app.post("/unsubscribe", async (req, res) => {
    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid phone numbers list" });
    }

    try {
        await unsubscribeMultipleContacts(phoneNumbers);
        res.json({ success: true, message: "Unsubscribed successfully", phoneNumbers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error unsubscribing", error: error.message });
    }
});

//  Start Express Server
app.listen(3000, () => {
    console.log(" Server is running on http://localhost:3000");
});

//  Start WhatsApp Client
startWhatsAppClient();
