const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Get the path to the user's app data folder
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'library.db');

// Path to the default database file packaged with the app
const defaultDbPath = path.join(__dirname, 'library.db');

// Copy the default DB to the user data folder if it doesn't exist
if (!fs.existsSync(dbPath)) {
    if (fs.existsSync(defaultDbPath)) {
        fs.copyFileSync(defaultDbPath, dbPath);
        console.log('Copied default database to user data folder.');
    } else {
        console.warn('Default database file not found. A new one will be created.');
    }
}

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the library database at:', dbPath);
    }
});

// Create tables if they don't exist
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
