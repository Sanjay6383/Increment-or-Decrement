const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
    secret: 'supersecret',
    resave: false,
    saveUninitialized: false
}));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Asiajnas@63831',
    database: 'budget_tracker'
});

db.connect(err =>{
    if(err) throw err;
    console.log("Database is connected successfully");
})

app.get("/",(req,res) =>{
    res.redirect("/login.html");
})
// Signup
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed], (err) => {
        if (err) return res.json({ success: false, message: 'Username already exists' });
        res.json({ success: true });
    });
});

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, message: 'User not found' });
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
            req.session.user = { id: results[0].id, username };
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Incorrect password' });
        }
    });
});

// Get current user
app.get('/getUser', (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });
    res.json({ username: req.session.user.username });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});


// Add income
app.post('/incomes', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const { description, amount, date } = req.body;

  db.query('SELECT income FROM users WHERE id = ?', [req.session.user.id], (err, results) => {
    if (err || results.length === 0) return res.status(500).json({ message: 'User not found' });

    const income = parseFloat(results[0].income);

    if (!income || income === 0) {
      return res.json({ success: false, message: 'Please set your income before adding expenses.' });
    }

    db.query('SELECT SUM(amount) AS total FROM incomes WHERE user_id = ?', [req.session.user.id], (err2, rows) => {
      if (err2) return res.status(500).json({ message: 'Error calculating total expense' });

      const totalExpense = parseFloat(rows[0].total) || 0;
      if (totalExpense + parseFloat(amount) > income) {
        return res.json({ success: false, message: 'Expense exceeds total income.' });
      }

      db.query(
        'INSERT INTO incomes (user_id, description, amount, date) VALUES (?, ?, ?, ?)',
        [req.session.user.id, description, amount, date],
        (err3, result) => {
          if (err3) return res.status(500).json({ message: 'Error adding expense' });

          res.json({ success: true, id: result.insertId });
        }
      );
    });
  });
});




// Get incomes
app.get('/incomes', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  db.query('SELECT id, description, amount, date FROM incomes WHERE user_id = ?', [req.session.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching incomes' });

    res.json(results);
  });
});


app.post('/set-income', (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

    const { income } = req.body;
    db.query('UPDATE users SET income = ? WHERE id = ?', [income, req.session.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Failed to set income' });
        res.json({ success: true });
    });
});

app.get('/get-income', (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

    db.query('SELECT income FROM users WHERE id = ?', [req.session.user.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ message: 'Error fetching income' });

        res.json({ income: results[0].income });
    });
});

app.delete('/incomes/:id', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const incomeId = req.params.id;

  db.query(
    'DELETE FROM incomes WHERE id = ? AND user_id = ?',
    [incomeId, req.session.user.id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Error deleting income' });

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Expense not found or not yours' });
      }

      res.json({ success: true });
    }
  );
});

app.get('/view-expenses', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const mode = req.query.mode;
  const userId = req.session.user.id;

  if (mode === 'day') {
    db.query(
      'SELECT description, amount, DATE_FORMAT(date, "%Y-%m-%d") AS date FROM incomes WHERE user_id = ? ORDER BY date',
      [userId],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'Error fetching day-wise data' });
        res.json(results);
      }
    );
  } else if (mode === 'month') {
  const query = `
    SELECT 
      DATE_FORMAT(MIN(date), '%M %Y') AS month,
      SUM(amount) AS total
    FROM incomes
    WHERE user_id = ?
    GROUP BY YEAR(date), MONTH(date)
    ORDER BY YEAR(date), MONTH(date)
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Month-wise SQL error:', err);
      return res.status(500).json({ message: 'Error fetching month-wise data' });
    }
    res.json(results);
  });
}

 else {
    res.status(400).json({ message: 'Invalid view mode' });
  }
});



app.listen(3000, () => console.log('Server running on http://localhost:3000'));
