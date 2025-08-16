// index.js

const express = require('express');
const dotenv = require('dotenv');
const { createAllTables } = require('./src/models/initDatabase');
const { startWhatsAppClient } = require('./src/utils/whatsapp');
const trackerRoutes = require('./src/routes/watrackRoutes');
const userRoutes = require('./src/routes/userRoutes');
const trackedNumbersRoutes = require('./src/routes/trackedNumbersRoutes');
const dailyStatsRoutes = require('./src/routes/dailyStatsRoutes');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();

// Catch uncaught synchronous exceptions
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: UNCAUGHT EXCEPTION!');
  console.error(err.stack);
  // Log the error and gracefully shut down the application
  // A non-zero exit code (1) indicates a fatal error.
  process.exit(1);
});

// Catch unhandled promise rejections (asynchronous errors)
process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: UNHANDLED PROMISE REJECTION!');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  // Log the error and shut down the application
  process.exit(1);
});

// --- END: GLOBAL CRITICAL ERROR HANDLERS ---

// Apply general middleware
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 120 })); // 120 req/min per IP

// Apply routes
app.use('/api/auth', userRoutes);
app.use('/api/tracked', trackedNumbersRoutes);
app.use('/api/daily-stats', dailyStatsRoutes);
app.use('/api/tracker', trackerRoutes);

// This middleware is the "catch-all" for any errors passed from a route or other middleware.
// The four parameters (err, req, res, next) signal to Express that this is an error handler.
app.use((err, req, res, next) => {
  // Log the error details to the console for your backend logs.
  console.error('--- A request failed ---');
  console.error('Request URL:', req.originalUrl);
  console.error('Request Method:', req.method);
  console.error('Error Status:', err.status || 500);
  console.error('Error Message:', err.message);
  console.error('Stack Trace:', err.stack); // Stack trace is vital for debugging!
  console.error('-----------------------');

  // Send a standardized error response to the client.
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message,

      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    }
  });
});

app.get("/health" ,async (req, res) => {
    console.log("Health check endpoint hit");
    res.status(200).json({ status: "OK" });
})

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
    // This existing error handler is now more consistent with the new logging format.
    console.error('Failed to initialize application:', err.stack);
    process.exit(1);
  }
}

initialize();