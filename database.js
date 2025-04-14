const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the database
const dbPath = path.join(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the library database.');
    }
});

// Create the borrowed_books table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS borrowed_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            borrower TEXT NOT NULL,
            category TEXT NOT NULL,
            borrowed_date TEXT NOT NULL,
            return_date TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS archived_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            borrower TEXT NOT NULL,
            category TEXT NOT NULL,
            borrowed_date TEXT NOT NULL,
            return_date TEXT NOT NULL,
            returned_date TEXT NOT NULL
        )
    `);
});
module.exports = db;