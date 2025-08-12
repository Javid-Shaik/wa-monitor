const express = require('express');
const dotenv = require('dotenv');
const { createAllTables } = require('./models/initDatabase');
const { startWhatsAppClient } = require('./utils/whatsapp');
const trackerRoutes = require('./routes/trackerRoutes');
const userRoutes = require('./routes/userRoutes');
const trackedNumbersRoutes = require('./routes/trackedNumbersRoutes');
const dailyStatsRoutes = require('./routes/dailyStatsRoutes');

dotenv.config();

const app = express();
app.use(express.json());

// Main API routes
app.use('/api', trackerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tracked', trackedNumbersRoutes);
app.use('/api/daily-stats', dailyStatsRoutes);

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Initialize the application components (Database and WhatsApp Client)
async function initialize() {
    try {
        await createAllTables();
        startWhatsAppClient();
    } catch (err) {
        console.error("Failed to initialize application:", err);
        process.exit(1);
    }
}

initialize();