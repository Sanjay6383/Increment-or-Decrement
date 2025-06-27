const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Asiajnas@63831',
    database: 'attendance_system'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    const query = 'SELECT * FROM staff WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).send('Server error');
        }
        
        if (results.length > 0) {
            req.session.loggedin = true;
            req.session.username = username;
            req.session.staffId = results[0].id;
            res.redirect('/dashboard.html');
        } else {
            res.status(401).send('Incorrect username or password');
        }
    });
});

app.get('/students', (req, res) => {
    if (!req.session.loggedin) {
        return res.status(401).send('Unauthorized');
    }
    
    const query = 'SELECT * FROM students';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Students fetch error:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

app.post('/attendance', (req, res) => {
    if (!req.session.loggedin) {
        return res.status(401).send('Unauthorized');
    }
    
    const { studentId, date, status } = req.body;
    const staffId = req.session.staffId;
    
    if (!studentId || !date || !status) {
        return res.status(400).send('Missing required fields');
    }
    
    const query = 'INSERT INTO attendance (student_id, date, status, recorded_by) VALUES (?, ?, ?, ?) ' +
                  'ON DUPLICATE KEY UPDATE status = VALUES(status)';
    db.query(query, [studentId, date, status, staffId], (err, results) => {
        if (err) {
            console.error('Attendance save error:', err);
            return res.status(500).send('Server error');
        }
        res.json({ success: true });
    });
});

app.get('/attendance/:date', (req, res) => {
    if (!req.session.loggedin) {
        return res.status(401).send('Unauthorized');
    }
    
    const date = req.params.date;
    const query = `
        SELECT a.student_id, s.name, s.class, a.status 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date = ?
    `;
    
    db.query(query, [date], (err, results) => {
        if (err) {
            console.error('Attendance fetch error:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

app.get('/attendance-dates', (req, res) => {
    if (!req.session.loggedin) {
        return res.status(401).send('Unauthorized');
    }
    
    const query = 'SELECT DISTINCT date FROM attendance ORDER BY date DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Attendance dates fetch error:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

app.get('/attendance-history', (req, res) => {
    if (!req.session.loggedin) {
        return res.status(401).send('Unauthorized');
    }
    
    const { studentId, month } = req.query;
    
    if (!studentId) {
        return res.status(400).send('Student ID is required');
    }
    
    let query = `
        SELECT date, status 
        FROM attendance 
        WHERE student_id = ?
    `;
    
    const params = [studentId];
    
    if (month && month !== 'all') {
        query += ' AND MONTH(date) = ?';
        params.push(month);
    }
    
    query += ' ORDER BY date DESC';
    
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Attendance history fetch error:', err);
            return res.status(500).send('Server error');
        }
        res.json(results);
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Server error');
        }
        res.redirect('/');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('Internal Server Error');
});

// New API to get attendance summary for a chart
app.get('/attendance-summary/:date', (req, res) => {
    if (!req.session.loggedin) return res.status(401).send('Unauthorized');

    const date = req.params.date;
    const query = `
        SELECT 
            COUNT(CASE WHEN status = 'present' THEN 1 END) AS present,
            COUNT(CASE WHEN status = 'absent' THEN 1 END) AS absent
        FROM attendance
        WHERE date = ?
    `;

    db.query(query, [date], (err, results) => {
        if (err) {
            console.error('Error fetching attendance summary:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Force 0 if null
        const response = {
            present: results[0].present || 0,
            absent: results[0].absent || 0
        };
        
        res.json(response);
    });
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});