const cron = require('node-cron');
const pool = require('./db');
const { checkBookingStatus } = require('./services/checkService');

// Default schedule: Every 15 minutes
const CRON_SCHEDULE = process.env.CHECK_STATUS_CRON || '*/15 * * * *';

let isRunning = false;

/**
 * Runs a sweep across all pending/on_time bookings on or past their flight date.
 * Can be called manually, by node-cron, or by a Vercel Serverless Cron endpoint.
 */
async function runCheckSweep() {
  if (isRunning) {
    console.log('⏭  Skipping sweep - previous sweep is still in progress.');
    return [];
  }

  isRunning = true;

  try {
    // 1. Fetch active bookings that haven't had a delay email sent yet
    const { rows: activeBookings } = await pool.query(
      `SELECT id FROM bookings
       WHERE status IN ('pending', 'on_time')
         AND email_sent_at IS NULL
         AND flight_date <= CURRENT_DATE
       ORDER BY flight_date ASC`
    );

    if (activeBookings.length === 0) {
      console.log('🔎 Auto-check sweep: No active bookings to inspect.');
      return [];
    }

    console.log(`🔎 Auto-check sweep starting for ${activeBookings.length} booking(s)...`);

    const results = [];

    // 2. Loop through each booking and check status against live radar
    for (const { id } of activeBookings) {
      try {
        const { emailed, airlabsStatus } = await checkBookingStatus(id);
        
        console.log(
          `   booking #${id}: AirLabs status "${airlabsStatus}"${
            emailed ? ' ➔ delay proof emailed!' : ''
          }`
        );

        results.push({ id, status: airlabsStatus, emailed, success: true });
      } catch (err) {
        console.error(`   booking #${id} check failed:`, err.message);
        results.push({ id, error: err.message, success: false });
      }
    }

    return results;

  } catch (err) {
    console.error('❌ Auto-check sweep failed:', err.message);
    throw err;
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the node-cron background task for local development or non-serverless hosting.
 */
function startScheduler() {
  console.log(`⏱  Automatic flight-delay checks scheduled (${CRON_SCHEDULE})`);
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runCheckSweep();
    } catch (err) {
      // Errors handled inside runCheckSweep
    }
  });
}

module.exports = { startScheduler, runCheckSweep };