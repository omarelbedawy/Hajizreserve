const pool = require('../db');
const { getFlightStatus } = require('./airlabs');
const { sendDelayProofEmail, sendPilgrimNotificationEmail } = require('./mailer');

const DELAY_THRESHOLD_MINUTES = parseInt(process.env.DELAY_THRESHOLD_MINUTES || '60', 10);

/**
 * Checks and updates status for a single booking ID.
 */
async function checkBookingStatus(bookingId) {
  const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  const booking = bookingResult.rows[0];

  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  // Fetch live radar status from AirLabs
  const { raw, delayMinutes, status } = await getFlightStatus(booking.flight_iata);

  const isCancelled = status === 'cancelled' || status === 'canceled';
  const isDelayed = delayMinutes >= DELAY_THRESHOLD_MINUTES;

  let newStatus = 'on_time';
  if (isCancelled) {
    newStatus = 'cancelled';
  } else if (isDelayed) {
    newStatus = 'delayed_verified';
  }

  // Update DB with latest flight inspection
  const updateResult = await pool.query(
    `UPDATE bookings
     SET status = $1, delay_minutes = $2, flight_status_raw = $3, checked_at = now()
     WHERE id = $4
     RETURNING *`,
    [newStatus, delayMinutes, raw, bookingId]
  );

  let updatedBooking = updateResult.rows[0];
  let emailed = false;

  const isDisrupted = isCancelled || isDelayed;

  // Send emails once per booking upon disruption
  if (isDisrupted && !updatedBooking.email_sent_at) {
    // 1. Send official proof notice to the hotel
    await sendDelayProofEmail(updatedBooking);

    // 2. Send confirmation notice to the traveler (if pilgrim email is provided)
    if (updatedBooking.pilgrim_email) {
      try {
        await sendPilgrimNotificationEmail(updatedBooking);
      } catch (userMailErr) {
        // Even if user's inbox bounces, hotel was successfully notified
        console.error(`Could not send confirmation to pilgrim:`, userMailErr.message);
      }
    }

    const emailedResult = await pool.query(
      `UPDATE bookings SET email_sent_at = now() WHERE id = $1 RETURNING *`,
      [bookingId]
    );
    updatedBooking = emailedResult.rows[0];
    emailed = true;
  }

  return { booking: updatedBooking, airlabsStatus: status, emailed };
}

/**
 * Sweeps all active bookings. Triggered by Vercel Cron or manual sweep.
 */
async function runCheckSweep() {
  const { rows: activeBookings } = await pool.query(
    `SELECT id FROM bookings
     WHERE status IN ('pending', 'on_time')
       AND email_sent_at IS NULL
       AND flight_date <= CURRENT_DATE
     ORDER BY flight_date ASC`
  );

  console.log(`🔎 Auto-check sweep starting for ${activeBookings.length} booking(s)...`);

  const results = [];
  for (const { id } of activeBookings) {
    try {
      const { emailed, airlabsStatus } = await checkBookingStatus(id);
      results.push({ id, status: airlabsStatus, emailed, success: true });
    } catch (err) {
      console.error(`   booking #${id} check failed:`, err.message);
      results.push({ id, error: err.message, success: false });
    }
  }

  return results;
}

module.exports = { checkBookingStatus, runCheckSweep, DELAY_THRESHOLD_MINUTES };