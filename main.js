const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database'); // Import the database module

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        title: "M'Salem School Library",
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets/library1.ico'), // Set icon here
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Ensure this is false to use ipcRenderer
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'login.html'));
});

const { autoUpdater } = require('electron-updater');

// Check for updates when the app is ready
app.whenReady().then(() => {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        console.log('Update available. Downloading...');
        mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
        console.log('Update downloaded. It will be installed on restart.');
        mainWindow.webContents.send('update-downloaded');
    });

    autoUpdater.on('error', (error) => {
        console.error('Error during update:', error.message);
        mainWindow.webContents.send('update-error', error.message);
    });
});

// Restart the app after the update is downloaded
ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Login authentication logic
require('dotenv').config(); // Load environment variables from .env

const adminUsername = process.env.ADMIN_USERNAME || 'msscla'; // Fallback to default
const adminPassword = process.env.ADMIN_PASSWORD || 'msscla1404'; // Fallback to default

ipcMain.on('login', (event, credentials) => {
    const { username, password } = credentials;

    // Simple authentication logic
    if (username === adminUsername && password === adminPassword) {
        mainWindow.loadFile(path.join(__dirname, 'index.html')); // Load the main page
    } else {
        event.reply('login-failed', 'Invalid username or password');
    }
});
// Handle adding a borrowed book
ipcMain.on('borrow-book', (event, book) => {
    const { title, borrower, category, borrowedDate, returnDate } = book;
    db.run(
        `INSERT INTO borrowed_books (title, borrower, category, borrowed_date, return_date) VALUES (?, ?, ?, ?, ?)`,
        [title, borrower, category, borrowedDate, returnDate],
        function (err) {
            if (err) {
                console.error('Error borrowing book:', err.message);
                event.reply('borrow-book-failed', 'Failed to borrow book.');
            } else {
                console.log('Book borrowed successfully.');
                event.reply('borrow-book-success', 'Book borrowed successfully.');
            }
        }
    );
});

const nodemailer = require('nodemailer');

// Fallback email credentials
const emailUser = process.env.EMAIL_USER || 'msalemschoollibrary@gmail.com'; // Default email
const emailPass = process.env.EMAIL_PASS || 'tmtmbcyculrupgaa'; // Default app password

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    },
    tls: {
        rejectUnauthorized: false // Allow self-signed certificates
    }
});

// Function to send email
ipcMain.on('send-active-books-email', (event, activeBooks) => {
    const emailBody = `
        <h2>Active Borrowed Books</h2>
        <table border="1" style="border-collapse: collapse; width: 100%;">
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Borrower</th>
                    <th>Category</th>
                    <th>Borrowed Date</th>
                    <th>Return Date</th>
                </tr>
            </thead>
            <tbody>
                ${activeBooks.map(book => `
                    <tr>
                        <td>${book.title}</td>
                        <td>${book.borrower}</td>
                        <td>${book.category}</td>
                        <td>${book.borrowed_date}</td>
                        <td>${book.return_date}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const mailOptions = {
        from: 'msalemschoollibrary@gmail.com', // Replace with your email
        to: 'saggrey96@gmail.com', // Replace with the recipient's email
        subject: 'Active Borrowed Books',
        html: emailBody
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err.message);
            event.reply('send-email-failed', 'Failed to send email.');
        } else {
            console.log('Email sent:', info.response);
            event.reply('send-email-success', 'Email sent successfully.');
        }
    });
});

ipcMain.on('get-borrowed-books', (event) => {
    db.all(`SELECT * FROM borrowed_books`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching borrowed books:', err.message);
            event.reply('get-borrowed-books-failed', 'Failed to fetch borrowed books.');
        } else {
            event.reply('get-borrowed-books-success', rows);
        }
    });
});

ipcMain.on('get-borrowed-stats', (event, timePeriod) => {
    const today = new Date();
    let startDate;

    if (timePeriod === 'week') {
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(today.setDate(diff));
    } else if (timePeriod === 'month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (timePeriod === 'year') {
        startDate = new Date(today.getFullYear(), 0, 1);
    }

    startDate = startDate.toISOString().split('T')[0];

    db.get(
        `SELECT 
            (SELECT COUNT(*) FROM borrowed_books WHERE borrowed_date >= ?) +
            (SELECT COUNT(*) FROM archived_books WHERE borrowed_date >= ?) AS count`,
        [startDate, startDate],
        (err, row) => {
            if (err) {
                console.error('Error fetching borrowed stats:', err.message);
                event.reply('get-borrowed-stats-failed', 'Failed to fetch borrowed stats.');
            } else {
                // Use 0 if row is null or row.count is not defined
                const count = (row && row.count) ? row.count : 0;
                event.reply('get-borrowed-stats-success', count);
            }
        }
    );
});


// ✅ Corrected overdue books handler
ipcMain.on('get-overdue-books', (event) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(
        `SELECT * FROM borrowed_books WHERE return_date < ?`,
        [today],
        (err, rows) => {
            if (err) {
                console.error('Error fetching overdue books:', err.message);
                event.reply('get-overdue-books-failed', 'Failed to fetch overdue books.');
            } else {
                event.reply('get-overdue-books-success', rows); // Send full overdue book records
            }
        }
    );
});

// Handle fetching archived books
ipcMain.on('get-archived-books', (event) => {
    db.all(`SELECT * FROM archived_books`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching archived books:', err.message);
            event.reply('get-archived-books-failed', 'Failed to fetch archived books.');
        } else {
            event.reply('get-archived-books-success', rows);
        }
    });
});


// Handle marking a book as returned
ipcMain.on('mark-as-returned', (event, bookId) => {
    db.get(`SELECT * FROM borrowed_books WHERE id = ?`, [bookId], (err, book) => {
        if (err || !book) {
            console.error('Error finding book:', err ? err.message : 'Book not found');
            event.reply('mark-as-returned-failed', 'Book not found.');
            return;
        }

        const returnedDate = new Date().toISOString().split('T')[0]; // Current date as returned date

        // Move book to archived_books
        db.run(
            `INSERT INTO archived_books (title, borrower, category, borrowed_date, return_date, returned_date) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [book.title, book.borrower, book.category, book.borrowed_date, book.return_date, returnedDate],
            function (err) {
                if (err) {
                    console.error('Error archiving book:', err.message);
                    event.reply('mark-as-returned-failed', 'Failed to archive book.');
                } else {
                    // Delete the book from borrowed_books
                    db.run(`DELETE FROM borrowed_books WHERE id = ?`, [bookId], function (err) {
                        if (err) {
                            console.error('Error deleting book:', err.message);
                            event.reply('mark-as-returned-failed', 'Failed to delete book.');
                        } else {
                            console.log('Book marked as returned successfully.');
                            event.reply('mark-as-returned-success', 'Book marked as returned successfully.');
                        }
                    });
                }
            }
        );
    });
});

// Handle deleting a borrowed book
ipcMain.on('delete-borrowed-book', (event, bookId) => {
    db.run(`DELETE FROM borrowed_books WHERE id = ?`, [bookId], function (err) {
        if (err) {
            console.error('Error deleting book:', err.message);
            event.reply('delete-borrowed-book-failed', err.message);
        } else {
            console.log('Book deleted successfully.');
            event.reply('delete-borrowed-book-success');
        }
    });
});

