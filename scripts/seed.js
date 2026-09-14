#!/usr/bin/env node
// Applies the database schema and seeds the super-admin user.
// Usage: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  const pool = new Pool({ connectionString: url });

  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'schema.sql'),
    'utf8',
  );
  await pool.query(schema);
  console.log('[seed] schema applied');

  const existing = await pool.query(
    'SELECT "_id" FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );

  if (existing.rowCount > 0) {
    console.log('[seed] admin user already exists, skipping');
  } else {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users ("firstName", "lastName", "email", "password", "role", "status")
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      ['System', 'Administrator', email.toLowerCase().trim(), hash, 'administrator'],
    );
    console.log('[seed] admin user created');
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});