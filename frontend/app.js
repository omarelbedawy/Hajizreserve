// Automatically uses local server when testing, or relative URL when live on Vercel
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '';

document.addEventListener('DOMContentLoaded', () => {
  const bookingForm = document.getElementById('booking-form');
  const checkStatusBtn = document.getElementById('check-status-btn');

  if (bookingForm) {
    bookingForm.addEventListener('submit', handleCreateBooking);
  }

  // Handle URL verification view if someone visits /verify/CODE
  const path = window.location.pathname;
  if (path.startsWith('/verify/')) {
    const code = path.split('/verify/')[1];
    if (code) {
      loadVerificationDetails(code);
    }
  }
});

/**
 * Creates a new booking and triggers instant live verification
 */
async function handleCreateBooking(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerText : 'Submit';
  if (submitBtn) submitBtn.innerText = 'Checking Flight Radar...';

  const formData = {
    pilgrim_name: document.getElementById('pilgrim_name').value.trim(),
    pilgrim_email: document.getElementById('pilgrim_email').value.trim(),
    flight_iata: document.getElementById('flight_iata').value.trim(),
    flight_date: document.getElementById('flight_date').value,
    hotel_name: document.getElementById('hotel_name').value.trim(),
    hotel_email: document.getElementById('hotel_email').value.trim(),
    booking_reference: document.getElementById('booking_reference')?.value.trim() || ''
  };

  try {
    const response = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create booking');
    }

    alert(`Booking created successfully! Status: ${data.status.toUpperCase()}`);
    displayBookingResult(data);
    bookingForm.reset();

  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    if (submitBtn) submitBtn.innerText = originalBtnText;
  }
}

/**
 * Manually forces an immediate status re-check for a booking ID
 */
async function triggerStatusCheck(bookingId) {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/check-status`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Status check failed');

    alert(`Flight Status Updated: ${data.status.toUpperCase()}`);
    displayBookingResult(data);
  } catch (err) {
    alert(`Status Check Error: ${err.message}`);
  }
}

/**
 * Displays booking status results on screen
 */
function displayBookingResult(booking) {
  const resultContainer = document.getElementById('booking-result');
  if (!resultContainer) return;

  const isDelayed = booking.status === 'delayed_verified';
  const isCancelled = booking.status === 'cancelled';

  let statusBadge = '<span style="color: green; font-weight: bold;">ON TIME</span>';
  if (isDelayed) {
    statusBadge = `<span style="color: orange; font-weight: bold;">VERIFIED DELAYED (${booking.delay_minutes} mins)</span>`;
  } else if (isCancelled) {
    statusBadge = '<span style="color: red; font-weight: bold;">FLIGHT CANCELLED</span>';
  } else if (booking.status === 'pending') {
    statusBadge = '<span style="color: gray; font-weight: bold;">PENDING CHECK</span>';
  }

  resultContainer.innerHTML = `
    <div style="border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-top: 15px;">
      <h3>Booking #${booking.id} - ${booking.pilgrim_name}</h3>
      <p><b>Flight:</b> ${booking.flight_iata} on ${booking.flight_date.split('T')[0]}</p>
      <p><b>Hotel:</b> ${booking.hotel_name} (${booking.hotel_email})</p>
      <p><b>Status:</b> ${statusBadge}</p>
      <p><b>Verification Code:</b> <code>${booking.verification_code}</code></p>
      <button onclick="triggerStatusCheck(${booking.id})">Re-check Flight Radar Now</button>
    </div>
  `;
}

/**
 * Public Verification Page Loader (for hotel receptionists)
 */
async function loadVerificationDetails(code) {
  const container = document.getElementById('verify-container') || document.body;
  container.innerHTML = '<h2>Verifying Flight Proof...</h2>';

  try {
    const response = await fetch(`${API_BASE_URL}/verify/${code}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Verification code invalid');

    const statusTitle = data.verified
      ? `<h1 style="color: green;">✔ VERIFIED FLIGHT DISRUPTION</h1>`
      : `<h1>Flight Status: ${data.status.toUpperCase()}</h1>`;

    container.innerHTML = `
      <div style="max-width: 500px; margin: 40px auto; padding: 20px; border: 2px solid #333; border-radius: 10px;">
        ${statusTitle}
        <p><b>Pilgrim:</b> ${data.pilgrim_name}</p>
        <p><b>Flight:</b> ${data.flight_iata} (${data.flight_date.split('T')[0]})</p>
        <p><b>Hotel Reserved:</b> ${data.hotel_name}</p>
        <p><b>Delay:</b> ${data.delay_minutes} minutes</p>
        <p><b>Last Checked:</b> ${new Date(data.checked_at).toLocaleString()}</p>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<h2 style="color: red;">Verification Failed: ${err.message}</h2>`;
  }
}