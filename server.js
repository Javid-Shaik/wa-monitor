const express = require('express');
const dotenv = require('dotenv');
const { createAllTables } = require('./src/models/initDatabase');
const authSessionsModel = require('./src/models/authSessionsModel');
const { initSession, getWhatsAppClient } = require('./src/utils/whatsapp');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Routes
const watrackRoutes = require('./src/routes/watrackRoutes');
const userRoutes = require('./src/routes/userRoutes');
const trackedNumbersRoutes = require('./src/routes/trackedNumbersRoutes');
const dailyStatsRoutes = require('./src/routes/dailyStatsRoutes');

dotenv.config();

const app = express();

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: UNCAUGHT EXCEPTION!');
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: UNHANDLED PROMISE REJECTION!');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    process.exit(1);
});

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Routes
app.use('/api/auth', userRoutes);
app.use('/api/tracked', trackedNumbersRoutes);
app.use('/api/daily-stats', dailyStatsRoutes);
app.use('/api/wa', watrackRoutes);

// Health Check Endpoint
app.get("/health", (req, res) => {
    console.log("Health check endpoint hit");
    const isWhatsAppConnected = getWhatsAppClient("your-main-session-id")?.ws.readyState === getWhatsAppClient("your-main-session-id")?.ws.OPEN;
    res.status(200).json({ 
        status: "OK",
        services: {
            database: "connected",
            whatsapp: isWhatsAppConnected ? "connected" : "disconnected"
        }
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('--- Request Failed ---');
    console.log('Incoming headers:', req.headers['content-type']);
    console.log('Request body:', req.body);
    console.error('URL:', req.originalUrl);
    console.error('Method:', req.method);
    console.error('Status:', err.status || 500);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);

    res.status(err.status || 500).json({
        error: {
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack
        }
    });
});

// Server Initialization
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Restore active sessions on startup
async function restoreSessions() {
    try {
        const sessions = await authSessionsModel.getAllSessions();
        let restoredCount = 0;
        
        for (const session of sessions) {
            if (session.auth) {
                console.log(`Restoring WhatsApp session: ${session.sessionId}`);
                try {
                    await initSession(
                        session.sessionId,
                        session.auth,
                        () => {}, // No QR handling needed for restores
                        async (creds) => {
                            await authSessionsModel.saveOrUpdateSession(
                                session.sessionId,
                                creds,
                                session.userId,
                                'LINKED'
                            );
                        },
                        { userId: session.userId }
                    );
                    restoredCount++;
                    console.log(`Restored WhatsApp session: ${session.sessionId}`);
                } catch (err) {
                    console.error(`Failed to restore session ${session.sessionId}:`, err);
                    // Mark as disconnected in DB
                    await authSessionsModel.saveOrUpdateSession(
                        session.sessionId,
                        session.auth,
                        session.userId,
                        'DISCONNECTED'
                    );
                }
            }
        }
        
        console.log(`Restored ${restoredCount} WhatsApp sessions`);
    } catch (err) {
        console.error('Failed to restore sessions:', err.stack);
    }
}

// Application Initialization
async function initialize() {
    try {
        // Ensure all tables exist
        await createAllTables();
        console.log('Database tables initialized');
        
        // Restore any existing WhatsApp sessions
        await restoreSessions();
    } catch (err) {
        console.error('Initialization failed:', err.stack);
        process.exit(1);
    }
}

initialize();