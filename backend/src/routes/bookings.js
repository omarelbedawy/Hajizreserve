// At the top of src/routes/bookings.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { checkBookingStatus, runCheckSweep } = require('../services/checkService'); // <--- Update this line

const router = express.Router();

// Validates 2-character airline code + 1 to 4 digits + optional suffix letter
const FLIGHT_IATA_REGEX = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;

/**
 * POST /bookings
 * Registers a new booking, formats dates cleanly, and immediately queries AirLabs.
 */
router.post('/bookings', async (req, res) => {
  try {
    const { pilgrim_name, pilgrim_email, flight_date, hotel_name, hotel_email, booking_reference } = req.body;
    let { flight_iata } = req.body;

    if (!pilgrim_name || !flight_iata || !flight_date || !hotel_name || !hotel_email) {
      return res.status(400).json({
        error: 'Missing required fields: pilgrim_name, flight_iata, flight_date, hotel_name, hotel_email',
      });
    }

    flight_iata = flight_iata.trim().toUpperCase().replace(/\s+/g, '');

    if (!FLIGHT_IATA_REGEX.test(flight_iata)) {
      return res.status(400).json({
        error: `"${flight_iata}" doesn't look like a valid flight number (expected format like "BA117" or "MS952").`,
      });
    }

    // Clean date parsing: Extract strictly YYYY-MM-DD to avoid timezone offset shifts
    const cleanFlightDate = flight_date.split('T')[0];
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (cleanFlightDate < todayStr) {
      return res.status(400).json({ error: 'Flight date must be today or in the future.' });
    }

    const verification_code = uuidv4().slice(0, 8).toUpperCase();

    const result = await pool.query(
      `INSERT INTO bookings
        (pilgrim_name, pilgrim_email, flight_iata, flight_date, hotel_name, hotel_email, booking_reference, verification_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [pilgrim_name, pilgrim_email, flight_iata, cleanFlightDate, hotel_name, hotel_email, booking_reference, verification_code]
    );

    const newBooking = result.rows[0];

    // Instantly check status live before returning response to client
    try {
      const { booking } = await checkBookingStatus(newBooking.id);
      return res.status(201).json(booking);
    } catch (checkErr) {
      // If AirLabs lookup fails or flight isn't live yet, still return created booking
      return res.status(201).json(newBooking);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * GET /bookings/:id/check-status
 * Manual trigger for checking a specific booking's flight status immediately.
 */
router.get('/bookings/:id/check-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { booking, airlabsStatus, emailed } = await checkBookingStatus(id);
    res.json({ ...booking, airlabs_status: airlabsStatus, emailed });
  } catch (err) {
    console.error(err);
    const code = err.statusCode || 500;
    res.status(code).json({ error: err.message || 'Failed to check flight status' });
  }
});

/**
 * GET /verify/:code
 * Public route accessed by hotels to verify flight delays or cancellations.
 */
router.get('/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query('SELECT * FROM bookings WHERE verification_code = $1', [code]);
    const booking = result.rows[0];

    if (!booking) {
      return res.status(404).json({ error: 'No booking found for this verification code' });
    }

    const isVerifiedDisruption = booking.status === 'delayed_verified' || booking.status === 'cancelled';

    res.json({
      pilgrim_name: booking.pilgrim_name,
      flight_iata: booking.flight_iata,
      flight_date: booking.flight_date,
      hotel_name: booking.hotel_name,
      status: booking.status,
      flight_status: booking.flight_status_raw?.response?.status || booking.flight_status_raw?.status || null,
      delay_minutes: booking.delay_minutes,
      checked_at: booking.checked_at,
      verified: isVerifiedDisruption,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify booking' });
  }
});


// Add this route to routes/bookings.js
router.get('/api/cron-check', async (req, res) => {
  try {
    const results = await runCheckSweep();
    res.json({ message: 'Cron sweep executed successfully', checked: results.length, details: results });
  } catch (err) {
    console.error('Cron sweep failed:', err);
    res.status(500).json({ error: 'Cron sweep failed' });
  }
});

module.exports = router;