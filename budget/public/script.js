let total = 0;
const usernameEl = document.getElementById('username');
const tableBody = document.getElementById('income-table-body');
const totalEl = document.getElementById('total');

const incomeInputSection = document.getElementById('income-input-section');
const incomeDisplay = document.getElementById('income-display');




fetch('/get-income')
    .then(res => res.json())
    .then(data => {
      const income = parseFloat(data.income);
      incomeDisplay.textContent = income.toFixed(2);

      if (income > 0) {
        incomeInputSection.style.display = 'none';
      } else {
        incomeInputSection.style.display = 'block';
      }
    });

fetch('/total-savings')
  .then(res => res.json())
  .then(data => {
    const savingsAmount = data.savings || 0;
    const savingsEl = document.getElementById('savings-display');
    savingsEl.textContent = savingsAmount.toFixed(2);
  })
  .catch(() => {
    const savingsEl = document.getElementById('savings-display');
    savingsEl.textContent = 'Error';
  });



fetch('/getUser')
  .then(res => res.json())
  .then(data => {
    usernameEl.textContent = data.username;
  });

fetch('/incomes')
  .then(res => res.json())
  .then(data => {
    for (const item of data) {
      addRow(item);
      total += parseFloat(item.amount);
    }
    totalEl.textContent = total.toFixed(2);
  });

document.getElementById('add-btn').addEventListener('click', () => {
  const description = document.getElementById('description').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const date = document.getElementById('date').value;

  if (!description || !amount || !date) return alert('Fill all fields');

  fetch('/incomes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description, amount, date })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    addRow({ id: data.id, description, amount, date }); 
    total += parseFloat(amount);
    totalEl.textContent = total.toFixed(2);
  } else {
    alert(data.message);
  }
});
});

document.getElementById('logout').addEventListener('click', () => {
  fetch('/logout', {
    method: 'POST'
  })
  .then(() => window.location.href = '/login.html');
});

function addRow({ id, description, amount, date }) {
  const row = tableBody.insertRow();

  const formattedDate = formatDate(date);

  row.insertCell().textContent = formattedDate;
  row.insertCell().textContent = description;
  row.insertCell().textContent = amount;

  const deleteCell = row.insertCell();
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.classList.add('delete-button');

  deleteBtn.addEventListener('click', () => {
    fetch(`/incomes/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          total -= parseFloat(amount);
          totalEl.textContent = total.toFixed(2);
          row.remove();
        } else {
          alert('Failed to delete item');
          console.error(data.message);
        }
      });
  });
  deleteCell.appendChild(deleteBtn);
}

function setIncome() {
  const income = document.getElementById('income-input').value;

  fetch('/set-income', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ income })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Income set successfully');
      incomeDisplay.textContent = parseFloat(income).toFixed(2);
      incomeInputSection.style.display = 'none';
    } else {
      alert('Failed to set income');
    }
  });
}


function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function logout() {
  fetch('/logout', {
    method: 'POST'
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      window.location.href = '/login.html'; 
    }
  });
}

function viewExpenses() {
  const mode = document.getElementById('view-mode').value;
  if (!mode) {
    alert('Please select view mode');
    return;
  }

  fetch('/view-expenses?mode=' + mode)
    .then(res => res.json())
    .then(data => {
      const tableBody = document.getElementById('income-table-body');
      tableBody.innerHTML = ''; // clear old table
      let total = 0;

      if (mode === 'day') {
        for (const row of data) {
          total += parseFloat(row.amount);
          tableBody.innerHTML += `
            <tr>
              <td>${formatDate(row.date)}</td>
              <td>${row.description}</td>
              <td>${parseFloat(row.amount).toFixed(2)}</td>
            </tr>`;
        }
      }

      else if (mode === 'month') {
        for (const row of data) {
          total += parseFloat(row.total);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><a href="#" class="month-link" data-month="${row.month}">${row.month}</a></td>
            <td><em>Monthly Total</em></td>
            <td>${parseFloat(row.total).toFixed(2)}</td>
          `;
          tableBody.appendChild(tr);
        }

        // Add click events to month links
        document.querySelectorAll('.month-link').forEach(link => {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            const month = this.dataset.month;


            document.getElementById('modal-month-label').textContent = month;
            document.getElementById('month-detail-modal').style.display = 'flex';
            const detailTable = document.getElementById('modal-details');
            detailTable.innerHTML = 'Loading...';

            fetch(`/view-expenses-by-month?month=${encodeURIComponent(month)}`)
              .then(res => res.json())
              .then(details => {
                detailTable.innerHTML = `
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr><th>Date</th><th>Description</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                      ${details.map(item => `
                        <tr>
                          <td>${item.date}</td>
                          <td>${item.description}</td>
                          <td>${parseFloat(item.amount).toFixed(2)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `;
              });
          });
        });

        // Close modal event
        document.getElementById('close-month-modal').onclick = () => {
          document.getElementById('month-detail-modal').style.display = 'none';
        };
      }

      document.getElementById('total').textContent = total.toFixed(2);
    });
}



function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}


function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function askAI() {
  const question = document.getElementById('chat-question').value;
  if (!question.trim()) return;

  fetch('/ask-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  })
    .then(res => res.json())
    .then(data => {
      const chatBox = document.getElementById('chat-box');
      chatBox.innerHTML += `<div><strong>You:</strong> ${question}</div>`;
      chatBox.innerHTML += `<div><strong>AI:</strong> ${data.answer}</div>`;
      chatBox.scrollTop = chatBox.scrollHeight;
      document.getElementById('chat-question').value = '';
    })
    .catch(() => {
      alert("AI server error. Please try again.");
    });
}


function promptDownload() {
  const from = prompt("Enter the start date (YYYY-MM-DD):");
  const to = prompt("Enter the end date (YYYY-MM-DD):");

  if (!from || !to) return alert("Both dates are required.");

  fetch('/download-expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromDate: from, toDate: to })
  })
    .then(res => {
      if (!res.ok) throw new Error("Download failed");
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'expenses_report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => alert(" Failed to generate or download PDF."));
}

function toggleChatbot() {
  const popup = document.getElementById("chatbot-popup");
  popup.style.display = (popup.style.display === "flex") ? "none" : "flex";
}

function sendChat() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  const messages = document.getElementById("chatbot-messages");
  messages.innerHTML += `<div><strong>You:</strong> ${msg}</div>`;
  input.value = "";

  fetch('/ask-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: msg })
  })
  .then(res => res.json())
  .then(data => {
    messages.innerHTML += `<div><strong>AI:</strong> ${data.answer}</div>`;
    messages.scrollTop = messages.scrollHeight;
  })
  .catch(() => {
    messages.innerHTML += `<div><strong>AI:</strong> Error getting response.</div>`;
  });
}

document.addEventListener('click', function (e) {
  const burst = document.createElement('div');
  burst.className = 'burst';
  burst.style.left = `${e.pageX - 40}px`;
  burst.style.top = `${e.pageY - 40}px`;
  document.body.appendChild(burst);

  setTimeout(() => burst.remove(), 600);
});

document.addEventListener('click', function (e) {
  if (e.target.classList.contains('month-link')) {
    e.preventDefault();
    const month = e.target.dataset.month;
    const year = e.target.dataset.year;
    const label = e.target.dataset.label;

    document.getElementById('modal-month-title').textContent = label;
    document.querySelector('#month-detail-modal').style.display = 'flex';
    const tbody = document.querySelector('#modal-detail-table tbody');
    tbody.innerHTML = 'Loading...';

    fetch(`/expenses-by-month?month=${month}&year=${year}`)
      .then(res => res.json())
      .then(data => {
        tbody.innerHTML = '';
        for (const row of data) {
          tbody.innerHTML += `
            <tr>
              <td>${formatDate(row.date)}</td>
              <td>${row.description}</td>
              <td>${parseFloat(row.amount).toFixed(2)}</td>
            </tr>
          `;
        }
      });
  }
});

document.getElementById('close-month-modal').addEventListener('click', () => {
  document.querySelector('#month-detail-modal').style.display = 'none';
});



