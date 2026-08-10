require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bookingsRouter = require('./routes/bookings');
const { startScheduler } = require('./scheduler');

const app = express();

app.use(cors());
app.use(express.json()); // Allows parsing JSON bodies (req.body)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Hajiz API is running successfully' });
});

app.use('/', bookingsRouter);

// Only listen directly on a port when running locally (node src/server.js)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Hajiz API listening on http://localhost:${PORT}`);
    startScheduler(); // Local background cron timer
  });
}

// Export app for Vercel Serverless
module.exports = app;