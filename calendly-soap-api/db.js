const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the parent directory's database
const db = new sqlite3.Database(path.join(__dirname, '../database.db'));

module.exports = db;
