const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * 1. Sends proof email to the HOTEL
 */
async function sendDelayProofEmail(booking) {
  const { hotel_email, hotel_name, pilgrim_name, flight_iata, delay_minutes, verification_code, status } = booking;
  const verifyUrl = `${process.env.PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${verification_code}`;

  const isCancelled = status === 'cancelled';
  const disruptionType = isCancelled ? 'Cancellation' : 'Delay';
  const detailsText = isCancelled
    ? `has been <b>CANCELLED</b>`
    : `has been officially verified as delayed by <b>${delay_minutes} minutes</b>`;

  await transporter.sendMail({
    from: `"Hajiz - Flight Verification" <${process.env.EMAIL_USER}>`,
    to: hotel_email,
    subject: `Verified Flight ${disruptionType} - Booking for ${pilgrim_name}`,
    html: `
      <h2>Flight ${disruptionType} Verified by Hajiz</h2>
      <p>Dear ${hotel_name},</p>
      <p>
        This is an automated notice confirming that pilgrim <b>${pilgrim_name}</b>'s
        flight <b>${flight_iata}</b> ${detailsText}.
      </p>
      <p>
        Please do <b>not</b> mark this reservation as a "No-Show".
        You can independently confirm this status here:
      </p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Verification code: <b>${verification_code}</b></p>
      <hr/>
      <p style="color:#888; font-size:12px;">Sent automatically by Hajiz.</p>
    `,
  });
}

/**
 * 2. Sends confirmation email to the TRAVELER / PILGRIM
 */
async function sendPilgrimNotificationEmail(booking) {
  const { pilgrim_email, pilgrim_name, hotel_name, flight_iata, delay_minutes, verification_code, status } = booking;
  const verifyUrl = `${process.env.PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${verification_code}`;

  const isCancelled = status === 'cancelled';
  const disruptionText = isCancelled
    ? `cancellation of your flight <b>${flight_iata}</b>`
    : `delay of <b>${delay_minutes} minutes</b> on flight <b>${flight_iata}</b>`;

  await transporter.sendMail({
    from: `"Hajiz Updates" <${process.env.EMAIL_USER}>`,
    to: pilgrim_email,
    subject: `Update: We've notified ${hotel_name} about your flight`,
    html: `
      <h2>Good news, ${pilgrim_name}!</h2>
      <p>
        We detected a ${disruptionText}.
      </p>
      <p>
        Don't worry! Hajiz has automatically sent an official flight disruption notice to <b>${hotel_name}</b> so they keep your reservation safe and do not mark you as a "No-Show".
      </p>
      <p>
        You can view or share your live verification page anytime here:
      </p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Verification code: <b>${verification_code}</b></p>
      <hr/>
      <p style="color:#888; font-size:12px;">Sent automatically by Hajiz.</p>
    `,
  });
}

module.exports = { sendDelayProofEmail, sendPilgrimNotificationEmail };