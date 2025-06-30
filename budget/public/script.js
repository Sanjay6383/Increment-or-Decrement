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
    addRow({ id: data.id, description, amount, date }); // 👈 use returned id
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
      window.location.href = '/login.html'; // Or wherever your login page is
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
      console.log('Response:', data);
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
      } else if (mode === 'month') {
          for (const row of data) {
            total += parseFloat(row.total);
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <tr>
                <td>${row.month}</td>
                <td><em>Monthly Total</em></td>
                <td>${parseFloat(row.total).toFixed(2)}</td>
              </tr>`;
            tableBody.appendChild(tr);
          }
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


