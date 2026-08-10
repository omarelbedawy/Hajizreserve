const { Pool } = require('pg');

// A "pool" reuses a handful of open connections instead of opening
// a brand new one for every query - much faster and Supabase-friendly.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
