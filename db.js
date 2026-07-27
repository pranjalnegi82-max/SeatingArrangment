// db.js - MySQL connection
//
// Upgraded from a single mysql.createConnection() to a connection
// pool. This is a drop-in replacement for existing code: pool.query()
// has the exact same callback signature as connection.query(), so
// every existing `db.query(sql, params, cb)` call in server.js keeps
// working unchanged.
//
// The pool additionally exposes a promise-based API (db.promise) so
// the new CSV import feature can use async/await transactions
// (needed for bulk insert + rollback support).
require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'qwertyui',
  database: process.env.DB_NAME || 'exam_seating',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.log('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
  connection.release();
});

// Promise-based pool for async/await + transactions (used by the
// student import service). Kept as a property on the same export so
// existing `const db = require('./db')` call sites are unaffected.
pool.promise = pool.promise();

module.exports = pool;
