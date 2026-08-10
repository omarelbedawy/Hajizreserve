// Automatically uses local server during dev, or relative paths when deployed on Vercel
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '';

document.addEventListener('DOMContentLoaded', () => {
  const bookingForm = document.getElementById('booking-form');
  const verifyForm = document.getElementById('verify-form');

  // Handle CTA Smooth Scrolling
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-goto');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Handle Forms
  if (bookingForm) bookingForm.addEventListener('submit', handleRegisterBooking);
  if (verifyForm) verifyForm.addEventListener('submit', handleVerifyBooking);

  // Check if someone visited /verify/CODE directly in the URL
  const path = window.location.pathname;
  if (path.startsWith('/verify/')) {
    const code = path.split('/verify/')[1];
    if (code) {
      const verifySection = document.getElementById('verify');
      if (verifySection) verifySection.scrollIntoView({ behavior: 'smooth' });
      executeVerification(code);
    }
  }
});

/**
 * 1. REGISTER BOOKING
 */
async function handleRegisterBooking(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  
  const errorEl = document.getElementById('register-error');
  const resultCard = document.getElementById('register-result');
  const codeEl = document.getElementById('register-code');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Reset UI State
  if (errorEl) { errorEl.hidden = true; errorEl.innerText = ''; }
  if (resultCard) resultCard.hidden = true;
  if (submitBtn) submitBtn.innerText = 'Checking Flight Radar...';

  const payload = {
    pilgrim_name: formData.get('pilgrim_name')?.trim(),
    pilgrim_email: formData.get('pilgrim_email')?.trim() || '',
    flight_iata: formData.get('flight_iata')?.trim(),
    flight_date: formData.get('flight_date'),
    hotel_name: formData.get('hotel_name')?.trim(),
    hotel_email: formData.get('hotel_email')?.trim(),
    booking_reference: formData.get('booking_reference')?.trim() || ''
  };

  try {
    const response = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to register booking');
    }

    // Display Verification Code
    if (codeEl) codeEl.innerText = data.verification_code || 'SUCCESS';
    if (resultCard) resultCard.hidden = false;
    
    form.reset();

  } catch (err) {
    if (errorEl) {
      errorEl.innerText = err.message;
      errorEl.hidden = false;
    } else {
      alert(`Error: ${err.message}`);
    }
  } finally {
    if (submitBtn) submitBtn.innerText = 'Register booking';
  }
}

/**
 * 2. VERIFY BOOKING (FORM TRIGGER)
 */
async function handleVerifyBooking(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const code = formData.get('code')?.trim();

  if (code) {
    executeVerification(code);
  }
}

/**
 * 3. EXECUTE VERIFICATION API LOOKUP
 */
async function executeVerification(code) {
  const errorEl = document.getElementById('verify-error');
  const resultContainer = document.getElementById('verify-result');

  if (errorEl) { errorEl.hidden = true; errorEl.innerText = ''; }
  if (resultContainer) {
    resultContainer.hidden = false;
    resultContainer.innerHTML = '<p class="mono">Checking verification status...</p>';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/verify/${code}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification code not found');
    }

    const isDisrupted = data.verified;
    const isCancelled = data.status === 'cancelled';

    let statusBadge = '<span style="color: green; font-weight: bold;">✔ ON TIME</span>';
    if (isCancelled) {
      statusBadge = '<span style="color: red; font-weight: bold;">❌ FLIGHT CANCELLED</span>';
    } else if (isDisrupted) {
      statusBadge = `<span style="color: orange; font-weight: bold;">⚠️ VERIFIED DELAYED (${data.delay_minutes} mins)</span>`;
    }

    if (resultContainer) {
      resultContainer.innerHTML = `
        <div style="padding: 10px 0;">
          <h3>Status: ${statusBadge}</h3>
          <p style="margin-top: 10px;"><b>Traveler:</b> ${data.pilgrim_name}</p>
          <p><b>Flight:</b> ${data.flight_iata} (${data.flight_date ? data.flight_date.split('T')[0] : ''})</p>
          <p><b>Hotel:</b> ${data.hotel_name}</p>
          <p><b>Last Inspection:</b> ${data.checked_at ? new Date(data.checked_at).toLocaleString() : 'N/A'}</p>
        </div>
      `;
    }

  } catch (err) {
    if (resultContainer) resultContainer.hidden = true;
    if (errorEl) {
      errorEl.innerText = err.message;
      errorEl.hidden = false;
    } else {
      alert(`Error: ${err.message}`);
    }
  }
}