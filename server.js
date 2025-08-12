const express = require('express');
const dotenv = require('dotenv');
const { createAllTables } = require('./src/models/initDatabase')
const { startWhatsAppClient } = require('./src/utils/whatsapp');
const trackerRoutes = require('./src/routes/watrackRoutes');
const userRoutes = require('./src/routes/userRoutes');
const trackedNumbersRoutes = require('./src/routes/trackedNumbersRoutes');
const dailyStatsRoutes = require('./src/routes/dailyStatsRoutes');

dotenv.config();

const app = express();
app.use(express.json());

// Main API routes
app.use('/api/users', userRoutes);
app.use('/api/tracked', trackedNumbersRoutes);
app.use('/api/daily-stats', dailyStatsRoutes);
app.use('/api/tracker', trackerRoutes); // Added new tracker routes

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Initialize the application components (Database and WhatsApp Client)
async function initialize() {
    try {
        await createAllTables();
        await startWhatsAppClient();
    } catch (err) {
        console.error("Failed to initialize application:", err);
        process.exit(1);
    }
}

initialize();