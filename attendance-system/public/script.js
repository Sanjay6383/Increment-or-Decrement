document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the login page
    if (document.getElementById('loginForm')) {
        const loginForm = document.getElementById('loginForm');
        
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
            })
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    return response.text();
                }
            })
            .then(message => {
                if (message) showMessage(message, 'error');
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('Login failed', 'error');
            });
        });
    }
    
    // Check if we're on the dashboard page
    if (document.getElementById('attendanceTable')) {
        // Initialize all dashboard components
        initializeDatePicker();
        initializeHistorySection();
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', function() {
            fetch('/logout')
                .then(() => {
                    window.location.href = '/';
                })
                .catch(error => {
                    console.error('Error:', error);
                    showMessage('Logout failed', 'error');
                });
        });
    }
});

// Load date picker and set to today by default
function initializeDatePicker() {
    const datePicker = document.getElementById('datePicker');
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    
    // Display current date
    document.getElementById('currentDate').textContent = formatDate(today);
    
    // Combined date change handler for both attendance and chart
    const handleDateChange = () => {
        const selectedDate = datePicker.value;
        document.getElementById('currentDate').textContent = formatDate(selectedDate);
        loadAttendance(selectedDate);
        loadAttendanceChart(selectedDate);
    };
    
    // Set up event listeners
    document.getElementById('viewBtn').addEventListener('click', handleDateChange);
    datePicker.addEventListener('change', handleDateChange);
    
    // Load initial data for today
    loadAttendance(today);
    loadAttendanceChart(today);
}

// Format date for display (e.g., "Mon Jan 01, 2024")
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Load attendance for a specific date
function loadAttendance(date) {
    showLoading(true);
    
    Promise.all([
        fetch(`/attendance/${date}`).then(res => res.json()),
        fetch('/students').then(res => res.json())
    ])
    .then(([attendance, students]) => {
        const tbody = document.getElementById('studentList');
        tbody.innerHTML = '';
        
        students.forEach(student => {
            const row = document.createElement('tr');
            const record = attendance.find(a => a.student_id === student.id);
            const status = record ? record.status : 'present'; // Default to present
            
            row.innerHTML = `
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>
                    <select class="status-select" data-student-id="${student.id}">
                        <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
                        <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
                    </select>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Add event listeners to all select elements
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', function() {
                const studentId = this.getAttribute('data-student-id');
                const status = this.value;
                const date = document.getElementById('datePicker').value;
                
                saveAttendance(studentId, date, status);
            });
        });
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Failed to load attendance data', 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Save attendance record
function saveAttendance(studentId, date, status) {
    showLoading(true);
    
    fetch('/attendance', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId, date, status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage('Attendance saved successfully!', 'success');
        } else {
            throw new Error('Save failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showMessage('Error saving attendance', 'error');
    })
    .finally(() => {
        showLoading(false);
    });
}

// Initialize history section
function initializeHistorySection() {
    // Populate student dropdown
    fetch('/students')
        .then(response => response.json())
        .then(students => {
            const select = document.getElementById('historyStudent');
            select.innerHTML = '<option value="">Select a student</option>';
            
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.name} (${student.class})`;
                select.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('Failed to load students', 'error');
        });
    
    // Handle history view button
    document.getElementById('viewHistoryBtn').addEventListener('click', function() {
        const studentId = document.getElementById('historyStudent').value;
        const month = document.getElementById('historyMonth').value;
        
        if (!studentId) {
            showMessage('Please select a student', 'error');
            return;
        }
        
        showLoading(true, 'historyResults');
        
        fetch(`/attendance-history?studentId=${studentId}&month=${month}`)
            .then(response => response.json())
            .then(data => {
                displayHistoryResults(data);
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('Failed to load history', 'error', 'historyResults');
            })
            .finally(() => {
                showLoading(false, 'historyResults');
            });
    });
}

// Display history results
function displayHistoryResults(data) {
    const container = document.getElementById('historyResults');
    
    if (data.length === 0) {
        container.innerHTML = '<p>No attendance records found</p>';
        return;
    }
    
    let html = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(record => {
        html += `
            <tr>
                <td>${formatDate(record.date)}</td>
                <td class="${record.status}">${record.status.toUpperCase()}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Show loading indicator
function showLoading(show, elementId = '') {
    const container = elementId ? document.getElementById(elementId) : document.body;
    
    if (show) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = 'Loading...';
        loader.id = 'loadingIndicator';
        container.appendChild(loader);
    } else {
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.remove();
    }
}

// Show message to user
function showMessage(message, type = 'success', elementId = '') {
    const container = elementId ? document.getElementById(elementId) : document.body;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Remove any existing messages first
    const existingMessages = container.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    container.prepend(messageDiv);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Function to load and render the chart
function loadAttendanceChart(date) {
    if (!date) {
        console.error('No date provided for chart');
        showMessage('Please select a valid date', 'error');
        return;
    }

    showLoading(true);
    
    fetch(`/attendance-summary/${date}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Chart data received:', data); // Debug log
            if (!data || typeof data.present === 'undefined' || typeof data.absent === 'undefined') {
                throw new Error('Invalid data format received from server');
            }
            renderChart(data.present, data.absent);
        })
        .catch(error => {
            console.error('Chart loading error:', error);
            showMessage(`Failed to load chart data: ${error.message}`, 'error');
            renderChart(0, 0); // Render empty chart as fallback
        })
        .finally(() => {
            showLoading(false);
        });
}

// Function to render the chart using Chart.js
function renderChart(present, absent) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    // Check if chart exists and has destroy method before trying to destroy
    if (window.attendanceChart && typeof window.attendanceChart.destroy === 'function') {
        window.attendanceChart.destroy();
    }

    // Create new chart instance
    window.attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                label: 'Attendance Count',
                data: [present, absent],
                backgroundColor: [
                    '#36a2eb', // Blue for present
                    '#ff6384'  // Red for absent
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Call this when a date is selected (add inside initializeDatePicker())
document.getElementById('datePicker').addEventListener('change', function() {
    const selectedDate = this.value;
    loadAttendanceChart(selectedDate);
});

// Load chart for today by default
loadAttendanceChart(new Date().toISOString().split('T')[0]);