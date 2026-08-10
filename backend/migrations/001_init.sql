-- One row = one pilgrim's flight + hotel booking that we're "protecting"

CREATE TABLE IF NOT EXISTS bookings (
    id                  SERIAL PRIMARY KEY,
    pilgrim_name        TEXT NOT NULL,
    pilgrim_email       TEXT,

    flight_iata         TEXT NOT NULL,      -- e.g. 'SV1' - the flight we watch
    flight_date         DATE NOT NULL,      -- the date the pilgrim says they fly

    hotel_name          TEXT NOT NULL,
    hotel_email         TEXT NOT NULL,      -- where we send the delay proof
    booking_reference   TEXT,               -- the hotel's own reservation number, optional

    verification_code   TEXT UNIQUE NOT NULL, -- hotel uses this to check status publicly

    status               TEXT NOT NULL DEFAULT 'pending',
    -- allowed values: 'pending' | 'on_time' | 'delayed_verified'

    delay_minutes        INTEGER,           -- filled in after we check AirLabs
    flight_status_raw    JSONB,             -- we keep the full AirLabs response as proof/evidence
    checked_at            TIMESTAMPTZ,       -- when we last checked the flight
    email_sent_at          TIMESTAMPTZ,       -- when (if) we notified the hotel

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_verification_code ON bookings (verification_code);
