require('dotenv').config();

const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

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


app.post('/incomes', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const { description, amount, date } = req.body;

  db.query('SELECT income FROM users WHERE id = ?', [req.session.user.id], (err, results) => {
    if (err || results.length === 0) return res.status(500).json({ message: 'User not found' });

    const income = parseFloat(results[0].income);
    if (!income || income === 0) {
      return res.json({ success: false, message: 'Please set your income before adding expenses.' });
    }

    const month = new Date(date).getMonth() + 1;
    const year = new Date(date).getFullYear();

    db.query(
      `SELECT SUM(amount) AS total 
       FROM incomes 
       WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?`,
      [req.session.user.id, month, year],
      (err2, rows) => {
        if (err2) return res.status(500).json({ message: 'Error calculating monthly expense' });

        const totalExpense = parseFloat(rows[0].total) || 0;
        if (totalExpense + parseFloat(amount) > income) {
          return res.json({ success: false, message: 'This month\'s expenses exceed the income limit.' });
        }

        db.query(
          'INSERT INTO incomes (user_id, description, amount, date) VALUES (?, ?, ?, ?)',
          [req.session.user.id, description, amount, date],
          (err3, result) => {
            if (err3) return res.status(500).json({ message: 'Error adding expense' });

            res.json({ success: true, id: result.insertId });
          }
        );
      }
    );
  });
});





app.get('/incomes', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  db.query(
    'SELECT id, description, amount, date FROM incomes WHERE user_id = ? ORDER BY date ASC',
    [req.session.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Error fetching incomes' });

      res.json(results);
    }
  );
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

app.post('/ask-ai', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const userId = req.session.user.id;
  const { question } = req.body;
  const lowerQuestion = question.trim().toLowerCase();

  const greetingsMap = {
    'hi': "Hi there! I'm your budget assistant. Ask me anything about your expenses, savings, or how to plan your monthly budget.",
    'hello': "Hello! Need help managing your money or creating a budget plan? I'm here to help.",
    'hey': "Hey! I'm ready to help you with your budgeting or expense tracking.",
    'hai': "Hi! You can ask me things like 'Where did I spend most last month?' or 'Give me a ₹25000 budget plan'.",
    'bye': "Goodbye! Keep tracking your spending and stick to your budget. See you soon!",
    'goodbye': "Take care! Don't forget to review your monthly expenses regularly.",
    'thanks': "You're welcome! Stay financially smart 💰.",
    'thank you': "Happy to help! Let me know if you need any budgeting advice again."
  };

  if (greetingsMap[lowerQuestion]) {
    return res.json({ answer: greetingsMap[lowerQuestion] });
  }

  const savingsCheckKeywords = ['what is my savings', 'how much did i save', 'my savings amount', 'savings for', 'total savings'];
  const savingKeywords = ['save', 'how can i save', 'reduce expenses', 'cut costs'];
  const plannerKeywords = ['planner', 'spending plan', 'budget plan', 'next month', 'how to spend', 'allocate'];

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  const isSavingsCheck = savingsCheckKeywords.some(k => lowerQuestion.includes(k));
  const isSavingQuestion = savingKeywords.some(k => lowerQuestion.includes(k));
  const isPlannerRequest = plannerKeywords.some(k => lowerQuestion.includes(k));
  const isMonthSavingsCheck = monthNames.some(m => lowerQuestion.includes(`${m} savings`) || lowerQuestion.includes(`savings for ${m}`));

  db.query('SELECT income FROM users WHERE id = ?', [userId], (err1, incomeResult) => {
    if (err1 || incomeResult.length === 0) {
      return res.status(500).json({ answer: 'Error fetching income data.' });
    }

    const userIncome = incomeResult[0].income || 0;

    db.query('SELECT description, amount, date FROM incomes WHERE user_id = ?', [userId], async (err2, expenses) => {
      if (err2) {
        return res.status(500).json({ answer: 'Error fetching expense data.' });
      }

      const fullData = expenses.map(r =>
        `On ${new Date(r.date).toLocaleDateString('en-IN')}: ₹${r.amount} was spent on ${r.description}`
      ).join('\n');

      let prompt = "";

      if (isPlannerRequest) {
        prompt = `You are a realistic and practical budget planner.
The user asked: "${question}"
Their monthly income is ₹${userIncome}.

Generate a basic one-month budget using **essential life categories**:
- Rent
- Groceries
- Food
- Transportation
- Utilities (Electricity, Internet, Water)
- Medical
- Savings
- Miscellaneous

Ensure the total is **close to** ₹${userIncome}. If slightly above, justify why (e.g., food, rent). Do not reject.

Output clearly like:

Rent: ₹xxxx  
Groceries: ₹xxxx  
Utilities: ₹xxxx  
...  
Savings: ₹xxxx  
Total: ₹25000

Keep it brief and practical.`;
      } else if (isMonthSavingsCheck) {
        const targetMonth = monthNames.find(m => lowerQuestion.includes(m));
        prompt = `
You are a financial assistant.

The user asked: "${question}"
Their monthly income is ₹${userIncome}.
Here are their expenses:
${fullData}

Extract expenses for the month of **${targetMonth}**, calculate total spent, subtract from income, and return:
"${targetMonth.charAt(0).toUpperCase() + targetMonth.slice(1)} 2025 savings: ₹xxxx"

Do not give tips or explanations.`;
      } else if (lowerQuestion.includes('total savings')) {
        prompt = `
You are a financial assistant.

The user asked: "${question}"
Their monthly income is ₹${userIncome}.
Here are their expenses:
${fullData}

Calculate total savings for **all available months combined** by subtracting total expenses from total income.
Show only the final total savings amount.

Example:
"Total savings (Jan–Jul): ₹xx,xxx"
`;
      } else if (isSavingsCheck) {
        prompt = `
You are a financial assistant.

The user asked: "${question}"
Their monthly income is ₹${userIncome}.
Here are their expenses:
${fullData}

Calculate their total savings per month by subtracting total expenses from income.
Only show the **numeric savings for each month**, like:

May 2025: ₹7,000  
June 2025: ₹5,300  
...

Don't include saving tips or explanations unless asked.`;
      } else if (isSavingQuestion) {
        prompt = `
You are a smart financial assistant.

The user asked: "${question}"
Their monthly income is ₹${userIncome}.

Based on their past spending:
${fullData}

Give **personalized and creative ways** to save money, reduce unnecessary expenses, and improve financial health. Be brief, practical, and specific.
Avoid repeating the 50/30/20 rule unless asked directly.`;
      } else {
        prompt = `
You are a helpful financial assistant.

The user asked: "${question}"
Their monthly income is ₹${userIncome}.
Their past expenses:
${fullData}

Reply only if the question is related to expenses, income, budgeting, or finance.
If it’s not relevant, say:
"Please ask something related to your income, expenses, or budgeting."

Avoid suggesting 50/30/20 unless the user directly asks about budgeting rules.
Keep your answer short (2-3 lines).`;
      }

      try {
        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
        const result = await model.generateContent([prompt]);
        const reply = await result.response.text();

        res.json({ answer: reply });
      } catch (err) {
        console.error('Gemini AI Error:', err);
        res.status(500).json({ answer: 'AI failed to generate a response.' });
      }
    });
  });
});



app.get('/total-savings', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const userId = req.session.user.id;

  db.query('SELECT income FROM users WHERE id = ?', [userId], (err1, result1) => {
    if (err1 || result1.length === 0) return res.status(500).json({ message: 'Error fetching income' });

    const monthlyIncome = result1[0].income;

    db.query('SELECT SUM(amount) AS total FROM incomes WHERE user_id = ?', [userId], (err2, result2) => {
      if (err2) return res.status(500).json({ message: 'Error fetching expenses' });

      const totalExpenses = result2[0].total || 0;

      db.query('SELECT COUNT(DISTINCT MONTH(date), YEAR(date)) AS months FROM incomes WHERE user_id = ?', [userId], (err3, result3) => {
        if (err3) return res.status(500).json({ message: 'Error counting months' });

        const months = result3[0].months || 0;
        const totalIncome = monthlyIncome * months;
        const totalSavings = totalIncome - totalExpenses;

        res.json({ savings: totalSavings });
      });
    });
  });
});

app.post('/download-expenses', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const { fromDate, toDate } = req.body;
  const userId = req.session.user.id;

  db.query(
    'SELECT description, amount, DATE_FORMAT(date, "%M") AS month, DATE_FORMAT(date, "%d-%m-%Y") AS date FROM incomes WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY MONTH(date), date ASC',
    [userId, fromDate, toDate],
    (err, results) => {
      if (err) return res.status(500).send('Error fetching data');
      if (results.length === 0) return res.status(404).send('No expenses found in the given date range.');

      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 30 });

      res.setHeader('Content-Disposition', 'attachment; filename="expenses_report.pdf"');
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      doc.fontSize(18).text('Expense Report', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).fillColor('black').text(`Expenses from ${fromDate} to ${toDate}`, { underline: true });
      doc.moveDown(0.5);

      const grouped = {};
      results.forEach(item => {
        if (!grouped[item.month]) grouped[item.month] = [];
        grouped[item.month].push(item);
      });

      const columnWidths = [120, 260, 100];
      let grandTotal = 0;

      Object.keys(grouped).forEach(month => {
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(13).text(month, { underline: true });
        doc.moveDown(0.3);

        const startY = doc.y;
        const tableLeft = 50;
        const rowHeight = 20;

        doc.rect(tableLeft, startY, columnWidths[0], rowHeight).fillAndStroke('#e0f2f1', '#ccc');
        doc.rect(tableLeft + columnWidths[0], startY, columnWidths[1], rowHeight).fillAndStroke('#e0f2f1', '#ccc');
        doc.rect(tableLeft + columnWidths[0] + columnWidths[1], startY, columnWidths[2], rowHeight).fillAndStroke('#e0f2f1', '#ccc');

        doc.fillColor('black').font('Helvetica-Bold');
        doc.text('Date', tableLeft + 5, startY + 5, { width: columnWidths[0] - 10 });
        doc.text('Description', tableLeft + columnWidths[0] + 5, startY + 5, { width: columnWidths[1] - 10 });
        doc.text('Amount', tableLeft + columnWidths[0] + columnWidths[1] + 5, startY + 5, { width: columnWidths[2] - 10 });

        let y = startY + rowHeight;
        doc.font('Helvetica');

        let monthlyTotal = 0;
        grouped[month].forEach(item => {
          if (y + rowHeight > doc.page.height - 50) {
            doc.addPage();
            y = doc.y;
            doc.rect(tableLeft, y, columnWidths[0], rowHeight).fillAndStroke('#e0f2f1', '#ccc');
            doc.rect(tableLeft + columnWidths[0], y, columnWidths[1], rowHeight).fillAndStroke('#e0f2f1', '#ccc');
            doc.rect(tableLeft + columnWidths[0] + columnWidths[1], y, columnWidths[2], rowHeight).fillAndStroke('#e0f2f1', '#ccc');
            doc.fillColor('black').font('Helvetica-Bold');
            doc.text('Date', tableLeft + 5, y + 5, { width: columnWidths[0] - 10 });
            doc.text('Description', tableLeft + columnWidths[0] + 5, y + 5, { width: columnWidths[1] - 10 });
            doc.text('Amount', tableLeft + columnWidths[0] + columnWidths[1] + 5, y + 5, { width: columnWidths[2] - 10 });
            y += rowHeight;
            doc.font('Helvetica');
          }

          doc.rect(tableLeft, y, columnWidths[0], rowHeight).stroke();
          doc.rect(tableLeft + columnWidths[0], y, columnWidths[1], rowHeight).stroke();
          doc.rect(tableLeft + columnWidths[0] + columnWidths[1], y, columnWidths[2], rowHeight).stroke();

          doc.text(item.date, tableLeft + 5, y + 5, { width: columnWidths[0] - 10 });
          doc.text(item.description, tableLeft + columnWidths[0] + 5, y + 5, { width: columnWidths[1] - 10 });
          doc.text(`Rs.${item.amount}`, tableLeft + columnWidths[0] + columnWidths[1] + 5, y + 5, { width: columnWidths[2] - 10 });

          monthlyTotal += item.amount;
          y += rowHeight;
        });

        doc.rect(tableLeft, y, columnWidths[0] + columnWidths[1], rowHeight).stroke();
        doc.rect(tableLeft + columnWidths[0] + columnWidths[1], y, columnWidths[2], rowHeight).stroke();

        doc.font('Helvetica-Bold');
        doc.text('Monthly Total:', tableLeft + 5, y + 5, { width: columnWidths[0] + columnWidths[1] - 10 });
        doc.text(`Rs.${monthlyTotal}`, tableLeft + columnWidths[0] + columnWidths[1] + 5, y + 5, { width: columnWidths[2] - 10 });

        grandTotal += monthlyTotal;
      });

      doc.moveDown();
      doc.fontSize(12).text(`Grand Total Expenses: Rs.${grandTotal}`, { align: 'right' });

      doc.end();
    }
  );
});

app.get('/view-expenses-by-month', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });

  const monthName = req.query.month;
  const userId = req.session.user.id;

  db.query(`
    SELECT DATE_FORMAT(date, '%d-%m-%Y') AS date, description, amount
    FROM incomes
    WHERE user_id = ? AND DATE_FORMAT(date, '%M %Y') = ?
    ORDER BY date ASC
  `, [userId, monthName], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching month data' });
    res.json(results);
  });
});

app.get('/expense-analysis', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });
  const userId = req.session.user.id;

  const monthQuery = `
    SELECT DATE_FORMAT(date, '%M %Y') AS month, SUM(amount) AS total
    FROM incomes
    WHERE user_id = ?
    GROUP BY month
    ORDER BY MIN(date)
  `;

  const categoryQuery = `
    SELECT description, SUM(amount) AS total
    FROM incomes
    WHERE user_id = ?
    GROUP BY description
    ORDER BY total DESC
  `;

  db.query(monthQuery, [userId], (err1, monthResults) => {
    if (err1) return res.status(500).json({ message: 'Error getting monthly data' });

    db.query(categoryQuery, [userId], (err2, categoryResults) => {
      if (err2) return res.status(500).json({ message: 'Error getting category data' });

      res.json({
        months: monthResults,
        categories: categoryResults
      });
    });
  });
});

app.post('/get-total', (req, res) => {
  db.query(`SELECT SUM(amount) AS total FROM incomes`, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    const total = results[0].total || 0;
    res.json({ total });
  });
});


app.listen(3000, () => console.log('Server running on http://localhost:3000'));
