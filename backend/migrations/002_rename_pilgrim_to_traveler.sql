-- Renames pilgrim_* columns to traveler_* now that Hajiz covers all
-- international travelers, not just pilgrims. Safe to run more than once.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'pilgrim_name'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN pilgrim_name TO traveler_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'pilgrim_email'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN pilgrim_email TO traveler_email;
  END IF;
END $$;