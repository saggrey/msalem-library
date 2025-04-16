const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    fetchBorrowedBooks();
    fetchArchivedBooks();
    fetchOverdueBooks();

    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            ipcRenderer.send('login', { username, password });
        });
    }

    ipcRenderer.on('login-failed', (event, message) => {
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = message;
        errorMessage.style.color = 'red';
    });

    // Toggle overdue notifications
    document.getElementById('toggle-overdue').addEventListener('click', () => {
        const overdueList = document.getElementById('overdue-list');
        if (overdueList.style.display === 'none' || overdueList.style.display === '') {
            overdueList.style.display = 'block';
            document.getElementById('toggle-overdue').textContent = 'Hide Overdue Notifications';
        } else {
            overdueList.style.display = 'none';
            document.getElementById('toggle-overdue').textContent = 'Show Overdue Notifications';
        }
    });
    
    document.getElementById('toggle-archived').addEventListener('click', () => {
        const archivedTable = document.querySelector('#archived-books table'); // Target only the table
        const toggleButton = document.getElementById('toggle-archived');
    
        if (archivedTable.style.display === 'none' || archivedTable.style.display === '') {
            archivedTable.style.display = 'table'; // Show the table
            toggleButton.textContent = 'Hide Archived Books';
        } else {
            archivedTable.style.display = 'none'; // Hide the table
            toggleButton.textContent = 'Show Archived Books';
        }
    });
    
    document.getElementById('add-book-form').addEventListener('submit', (event) => {
        event.preventDefault();
    
        const title = document.getElementById('book-title').value;
        const borrower = document.getElementById('borrower-name').value;
        const category = document.getElementById('category').value;
        const borrowedDate = document.getElementById('borrowed-date').value;
        const returnDate = document.getElementById('return-date').value;
    
        if (!validateDates(borrowedDate, returnDate)) return;
    
        if (confirm(`Are you sure you want to add the book "${title}" for borrower "${borrower}"?`)) {
            ipcRenderer.send('borrow-book', { title, borrower, category, borrowedDate, returnDate });
    
            // Clear the form and reset dropdown
            document.getElementById('add-book-form').reset();
            document.getElementById('category').selectedIndex = 0;
    
            // Immediately refresh book list to reflect new addition
            setTimeout(() => {
                fetchBorrowedBooks();
                fetchOverdueBooks();
            }, 300); // Slight delay to allow backend to update
        }
    });
    
    // View stats
    document.getElementById('view-stats').addEventListener('click', () => {
        const statsResult = document.getElementById('stats-result'); // Get the stats result container
        const timePeriod = document.getElementById('time-period').value; // Get the selected time period
        const viewStatsButton = document.getElementById('view-stats'); // Get the button element
    
        // Check if the stats result is currently visible
        if (statsResult.style.display === 'none' || statsResult.style.display === '') {
            // Send the selected time period to the main process
            ipcRenderer.send('get-borrowed-stats', timePeriod);
    
            // Listen for the response from the main process
            ipcRenderer.once('get-borrowed-stats-success', (event, count) => {
                statsResult.textContent = `Total books borrowed during selected period: ${count}`;
                statsResult.style.display = 'block'; // Show the stats result
            });
    
            ipcRenderer.once('get-borrowed-stats-failed', (event, message) => {
                statsResult.textContent = `Error: ${message}`;
                statsResult.style.color = 'red';
                statsResult.style.display = 'block'; // Show the error message
            });
    
            viewStatsButton.textContent = 'Hide Stats'; // Update button text
        } else {
            statsResult.style.display = 'none'; // Hide the stats result
            viewStatsButton.textContent = 'View Stats'; // Update button text
        }
    });

}); // Closing brace for DOMContentLoaded event listener

function validateDates(borrowedDate, returnDate) {
    const borrow = new Date(borrowedDate);
    const ret = new Date(returnDate);

    if (!borrowedDate || !returnDate) {
        alert('Please select both borrowed and return dates.');
        return false;
    }

    if (isNaN(borrow.getTime()) || isNaN(ret.getTime())) {
        alert('Invalid date format.');
        return false;
    }

    if (ret < borrow) {
        alert('Return date cannot be earlier than borrowed date.');
        return false;
    }

    return true;
}

function clearForm() {
    document.getElementById('book-title').value = '';
    document.getElementById('borrower-name').value = '';
    document.getElementById('category').value = '';
    document.getElementById('borrowed-date').value = '';
    document.getElementById('return-date').value = '';
}

ipcRenderer.on('borrow-book-success', () => {
    alert('Book added successfully!');
    clearForm();
    fetchBorrowedBooks();
    fetchOverdueBooks();
});

ipcRenderer.on('borrow-book-failed', (event, message) => {
    alert(message);
});

function fetchOverdueBooks() {
    ipcRenderer.send('get-overdue-books');
}

ipcRenderer.on('get-overdue-books-success', (event, overdueBooks) => {
    const overdueList = document.getElementById('overdue-list');
    overdueList.innerHTML = '';

    if (overdueBooks.length > 0) {
        overdueBooks.forEach((book) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${book.title} (Borrower: ${book.borrower}, Return Date: ${book.return_date})`;
            overdueList.appendChild(listItem);
        });
    } else {
        const listItem = document.createElement('li');
        listItem.textContent = 'No overdue books.';
        overdueList.appendChild(listItem);
    }
});

ipcRenderer.on('get-overdue-books-failed', (event, message) => {
    console.error(message);
});

function fetchBorrowedBooks() {
    ipcRenderer.send('get-borrowed-books');
}

ipcRenderer.on('get-borrowed-books-success', (event, books) => {
    const bookList = document.getElementById('active-books-list');
    bookList.innerHTML = '';

    books.forEach((book) => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', book.id);
        row.innerHTML = `
            <td>${book.title}</td>
            <td>${book.borrower}</td>
            <td>${book.category}</td>
            <td>${book.borrowed_date}</td>
            <td>${book.return_date}</td>
            <td>
                <button class="mark-returned-button" onclick="markAsReturned(${book.id})">Mark as Returned</button>
            </td>
        `;
        bookList.appendChild(row);
    });

    // ✅ Force a repaint
    bookList.style.display = 'none';
    void bookList.offsetHeight; // Trigger reflow
    bookList.style.display = '';
});

function fetchArchivedBooks() {
    ipcRenderer.send('get-archived-books');
}

ipcRenderer.on('get-archived-books-success', (event, books) => {
    const bookList = document.getElementById('archived-books-list');
    bookList.innerHTML = '';

    books.forEach((book) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${book.title}</td>
            <td>${book.borrower}</td>
            <td>${book.category}</td>
            <td>${book.borrowed_date}</td>
            <td>${book.returned_date}</td>
        `;
        bookList.appendChild(row);
    });
});

ipcRenderer.on('get-archived-books-failed', (event, message) => {
    console.error(message);
});

function markAsReturned(bookId) {
    if (confirm('Are you sure you want to mark this book as returned?')) {
        ipcRenderer.send('mark-as-returned', bookId);
    }
}

ipcRenderer.on('mark-as-returned-success', () => {
    alert('Book marked as returned successfully!');
    fetchBorrowedBooks();
    fetchArchivedBooks();
    fetchOverdueBooks();
});

ipcRenderer.on('mark-as-returned-failed', (event, message) => {
    alert(message);
});
ipcRenderer.on('get-borrowed-stats-success', (event, count) => {
    const statsResult = document.getElementById('stats-result');
    statsResult.textContent = `Total books borrowed during selected period: ${count}`;
});

ipcRenderer.on('get-borrowed-stats-failed', (event, message) => {
    const statsResult = document.getElementById('stats-result');
    statsResult.textContent = `Error: ${message}`;
    statsResult.style.color = 'red';
});
// ----- ROTATING QUOTES SETUP -----
const quotes = [
    "Reading is the gateway skill that makes all other learning possible. – Barack Obama",
    "A book is a dream that you hold in your hand. – Neil Gaiman",
    "A room without books is like a body without a soul. – Cicero",
    "Books are a uniquely portable magic. – Stephen King",
    "Reading is to the mind what exercise is to the body. – Joseph Addison",
    "Today a reader, tomorrow a leader. – Margaret Fuller",
    "Books are the mirrors of the soul. – Virginia Woolf",
    "Reading is a discount ticket to everywhere. – Mary Schmich",
    "Books are the quietest and most constant of friends. – Charles W. Eliot",
    "There is no friend as loyal as a book. – Ernest Hemingway"
];

const headerQuote = document.querySelector('.header-quote');
let currentQuoteIndex = 0;

// Function to rotate quotes with fade effect
function rotateQuotes() {
    headerQuote.classList.add('fade-out');
    setTimeout(() => {
        currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
        headerQuote.textContent = quotes[currentQuoteIndex];
        headerQuote.classList.remove('fade-out');
    }, 500);
}

// Set an interval to rotate quotes every 5 seconds (5000ms)
setInterval(rotateQuotes, 5000);

function sendActiveBooksEmail() {
    // Show a confirmation popup
    const confirmation = confirm("Are you sure you want to send the Active Borrowed Books email?");
    if (!confirmation) {
        alert("Email sending canceled.");
        return;
    }

    const activeBooks = []; // Collect active borrowed books from the DOM

    const rows = document.querySelectorAll('#active-books-list tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        activeBooks.push({
            title: cells[0].textContent,
            borrower: cells[1].textContent,
            category: cells[2].textContent,
            borrowed_date: cells[3].textContent,
            return_date: cells[4].textContent
        });
    });

    ipcRenderer.send('send-active-books-email', activeBooks);
}
const { ipcRenderer } = require('electron');

// Notify the user when an update is available
ipcRenderer.on('update-available', () => {
    alert('A new update is available. It is being downloaded.');
});

// Notify the user when the update is downloaded
ipcRenderer.on('update-downloaded', () => {
    const restart = confirm('Update downloaded. Do you want to restart the app to apply the update?');
    if (restart) {
        ipcRenderer.send('restart-app');
    }
});

// Notify the user if there is an error during the update process
ipcRenderer.on('update-error', (event, errorMessage) => {
    alert(`Error during update: ${errorMessage}`);
});