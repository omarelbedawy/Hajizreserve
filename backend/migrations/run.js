require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
});

async function migrate() {
  const sqlPath = path.join(__dirname, '001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration: 001_init.sql ...');
  await pool.query(sql);
  console.log('✅ Migration complete. "bookings" table is ready.');

  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
