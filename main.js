// Demo storage
let currentUser = null;
let users = {
  'john': { password: '12345', role: 'staff', name: 'John Doe', email: 'john@mail.com' },
  'admin': { password: 'admin123', role: 'hod', name: 'Boss Man', email: 'admin@mail.com' }
};
let reports = [];

/* ===== Auth ===== */
function showLogin() {
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('registerForm').classList.remove('active');
  clearMessages();
}

function showRegister() {
  document.getElementById('registerForm').classList.add('active');
  document.getElementById('loginForm').classList.remove('active');
  clearMessages();
}

function clearMessages() {
  document.getElementById('loginMessage').innerHTML = '';
  document.getElementById('registerMessage').innerHTML = '';
}

function register() {
  const name = document.getElementById('regFullName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirmPassword').value;
  const role = document.getElementById('regRole').value;

  if (!name || !username || !email || !pass || !confirm) {
    showMessage('registerMessage', 'All fields are required', 'error');
    return;
  }
  if (pass !== confirm) {
    showMessage('registerMessage', 'Passwords do not match', 'error');
    return;
  }
  if (users[username]) {
    showMessage('registerMessage', 'Username already exists', 'error');
    return;
  }

  users[username] = { password: pass, role, name, email };
  showMessage('registerMessage', 'Registration successful! Please login.', 'success');

  setTimeout(() => {
    showLogin();
  }, 2000);
}

function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showMessage('loginMessage', 'Enter username and password', 'error');
    return;
  }

  if (users[username] && users[username].password === password) {
    currentUser = { ...users[username], username };
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userBadge').textContent = `${currentUser.name} (${currentUser.role})`;

    if (currentUser.role === 'staff') {
      document.getElementById('staffDashboard').style.display = 'block';
      document.getElementById('hodDashboard').style.display = 'none';
      loadStaffReports();
    } else if (currentUser.role === 'hod') {
  document.getElementById('staffDashboard').style.display = 'none';
  document.getElementById('dashboard').classList.remove('active');
  loadHodDashboard();
}

  } else {
    showMessage('loginMessage', 'Invalid login details', 'error');
  }
}

function logout() {
  currentUser = null;
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

/* ===== Tabs ===== */
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');

  if (tabId === "myreports") loadStaffReports();
  if (tabId === "allreports") loadAllReports();
}

/* ===== Reports ===== */
function submitReport() {
  const weekEnding = document.getElementById('reportWeek').value;
  const fileInput = document.getElementById('reportFile');
  const file = fileInput.files[0];

  if (!weekEnding || !file) {
    showMessage('submitMessage', 'Please select week ending and upload PDF', 'error');
    return;
  }
  if (file.type !== "application/pdf") {
    showMessage('submitMessage', 'Only PDF files allowed', 'error');
    return;
  }

  const pdfUrl = URL.createObjectURL(file);

  reports.push({
    id: reports.length + 1,
    staff: currentUser.username,
    weekEnding,
    fileName: file.name,
    pdfUrl,
    status: "submitted",
    submittedDate: new Date().toISOString().split('T')[0]
  });

  showMessage('submitMessage', 'Report uploaded successfully!', 'success');
  fileInput.value = '';
}

function loadStaffReports() {
  const myReports = reports.filter(r => r.staff === currentUser.username);
  const container = document.getElementById('staffReports');
  if (!myReports.length) {
    container.innerHTML = "<p>No reports yet.</p>";
    return;
  }
  container.innerHTML = myReports.map(r => `
  <div class="report-card">
    <div class="report-header">
      <h3>Week Ending: ${r.weekEnding}</h3>
      <span class="status-badge status-${r.status}">${r.status}</span>
    </div>
    <a href="${r.pdfUrl}" target="_blank" class="btn">View ${r.fileName}</a>
  </div>
`).join('');

}

function loadAllReports() {
  const container = document.getElementById('allReportsList');
  if (!reports.length) {
    container.innerHTML = "<p>No reports submitted yet.</p>";
    return;
  }
  container.innerHTML = reports.map(r => `
  <div class="report-card">
    <div class="report-header">
      <div>
        <h3>${users[r.staff]?.name || r.staff}</h3>
        <p>Week Ending: ${r.weekEnding}</p>
      </div>
      <span class="status-badge status-${r.status}">${r.status}</span>
    </div>
    <a href="${r.pdfUrl}" target="_blank" class="btn">Download ${r.fileName}</a>
  </div>
`).join('');

}

/* ===== Helpers ===== */
function showMessage(containerId, text, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="${type}-message">${text}</div>`;
  setTimeout(() => (container.innerHTML = ""), 3000);
}

/* ===== NEW HOD PANEL FUNCTIONS ===== */

function showHodSection(sectionId) {
  document.querySelectorAll('.hod-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`hod-${sectionId}`).classList.add('active');

  document.querySelectorAll('.hod-sidebar li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

// When HOD logs in, populate dashboard
function loadHodDashboard() {
  document.getElementById('hodDashboard').style.display = 'flex';
  updateHodStats();
  loadHodReports();
  loadHodStaff();
}

function updateHodStats() {
  document.getElementById('hodTotal').textContent = reports.length;
  document.getElementById('hodApproved').textContent = reports.filter(r => r.status === 'approved').length;
  document.getElementById('hodPending').textContent = reports.filter(r => r.status === 'submitted').length;
  document.getElementById('hodRejected').textContent = reports.filter(r => r.status === 'rejected').length;
}

function loadHodReports() {
  const container = document.getElementById('hodReportsList');
  if (!reports.length) {
    container.innerHTML = "<p>No reports yet.</p>";
    return;
  }
  container.innerHTML = reports.map(r => `
    <div class="hod-report-card">
      <h4>${users[r.staff]?.name || r.staff}</h4>
      <p>Week Ending: ${r.weekEnding}</p>
      <div>
        <button class="btn" onclick="approveReport(${r.id})">Approve</button>
        <button class="btn" onclick="rejectReport(${r.id})">Reject</button>
        <a href="${r.pdfUrl}" target="_blank" class="btn">View</a>
      </div>
    </div>
  `).join('');
}

function loadHodStaff() {
  const container = document.getElementById('hodStaffList');
  const staffUsers = Object.entries(users).filter(([u, info]) => info.role === 'staff');
  if (!staffUsers.length) {
    container.innerHTML = "<p>No staff yet.</p>";
    return;
  }
  container.innerHTML = staffUsers.map(([username, info]) => `
    <div class="hod-staff-card">
      <h4>${info.name}</h4>
      <p>${info.email}</p>
      <p>Reports: ${reports.filter(r => r.staff === username).length}</p>
    </div>
  `).join('');
}

// Update report status
function approveReport(id) {
  const r = reports.find(rep => rep.id === id);
  if (r) r.status = 'approved';
  loadHodReports();
  updateHodStats();
}
function rejectReport(id) {
  const r = reports.find(rep => rep.id === id);
  if (r) r.status = 'rejected';
  loadHodReports();
  updateHodStats();
}
