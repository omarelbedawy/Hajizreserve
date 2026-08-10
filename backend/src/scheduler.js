// scheduler.js
const cron = require('node-cron');
const pool = require('./db');
const { checkBookingStatus } = require('./services/checkService');

const CRON_SCHEDULE = process.env.CHECK_STATUS_CRON || '*/15 * * * *';

let isRunning = false;

async function runCheckSweep() {
  if (isRunning) {
    console.log('⏭  Skipping sweep - previous one is still running');
    return;
  }
  isRunning = true;

  try {
    // Check both 'pending' and 'on_time' bookings whose emails haven't been sent yet
    const { rows: activeBookings } = await pool.query(
      `SELECT id FROM bookings
       WHERE status IN ('pending', 'on_time')
         AND email_sent_at IS NULL
         AND flight_date <= CURRENT_DATE
       ORDER BY flight_date ASC`
    );

    if (activeBookings.length === 0) return;

    console.log(`🔎 Auto-check sweep: ${activeBookings.length} active booking(s)`);

    for (const { id } of activeBookings) {
      try {
        const { emailed, airlabsStatus } = await checkBookingStatus(id);
        console.log(`   booking #${id}: airlabs status "${airlabsStatus}"${emailed ? ' -> delay proof emailed' : ''}`);
      } catch (err) {
        console.error(`   booking #${id} check failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('Auto-check sweep failed:', err.message);
  } finally {
    isRunning = false;
  }
}

function startScheduler() {
  console.log(`⏱  Automatic flight-delay checks scheduled (${CRON_SCHEDULE})`);
  cron.schedule(CRON_SCHEDULE, runCheckSweep);
}

module.exports = { startScheduler, runCheckSweep };