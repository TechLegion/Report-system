// API-driven frontend
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000/api' : '/api';
let authToken = localStorage.getItem('authToken') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

function setSession(token, user) {
  authToken = token;
  currentUser = user;
  if (token) localStorage.setItem('authToken', token); else localStorage.removeItem('authToken');
  if (user) localStorage.setItem('currentUser', JSON.stringify(user)); else localStorage.removeItem('currentUser');
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

/* ===== UI helpers ===== */
function showLogin() {
  document.getElementById('landingSection').classList.remove('active');
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('registerForm').classList.remove('active');
  clearMessages();
}

function showRegister() {
  document.getElementById('landingSection').classList.remove('active');
  document.getElementById('registerForm').classList.add('active');
  document.getElementById('loginForm').classList.remove('active');
  clearMessages();
}

function clearMessages() {
  document.getElementById('loginMessage').innerHTML = '';
  document.getElementById('registerMessage').innerHTML = '';
  const s = document.getElementById('submitMessage');
  if (s) s.innerHTML = '';
}

function showMessage(containerId, text, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="${type}-message">${text}</div>`;
  setTimeout(() => (container.innerHTML = ''), 3000);
}

// Toasts & Loader
function showToast(message, kind = 'success') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function setLoading(_isLoading) { /* no-op */ }

// Theme handling
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ===== Auth ===== */
async function register() {
  const name = document.getElementById('regFullName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirmPassword').value;
  const role = document.getElementById('regRole').value;

  if (!name || !username || !email || !password || !confirm) {
    showMessage('registerMessage', 'All fields are required', 'error');
    return;
  }
  if (password !== confirm) {
    showMessage('registerMessage', 'Passwords do not match', 'error');
    return;
  }
  try {
    setLoading(true);
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password, role })
    });
    showMessage('registerMessage', 'Registration successful! Please login.', 'success');
    showToast('Registration successful', 'success');
    setTimeout(() => showLogin(), 1200);
  } catch (e) {
    showMessage('registerMessage', e.message, 'error');
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) {
    showMessage('loginMessage', 'Enter username and password', 'error');
    return;
  }
  try {
    setLoading(true);
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setSession(data.token, data.user);
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userBadge').textContent = `${currentUser.name} (${currentUser.role.toLowerCase()})`;

    if (currentUser.role === 'STAFF') {
      document.getElementById('staffDashboard').style.display = 'block';
      document.getElementById('hodDashboard').style.display = 'none';
      await loadStaffReports();
    } else if (currentUser.role === 'HOD') {
      document.getElementById('staffDashboard').style.display = 'none';
      await loadHodDashboard();
    }
    showToast('Welcome back!', 'success');
  } catch (e) {
    showMessage('loginMessage', e.message, 'error');
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

function logout() {
  setSession(null, null);
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

  if (tabId === 'myreports') loadStaffReports();
}

/* ===== Reports (Staff) ===== */
async function submitReport() {
  const weekEnding = document.getElementById('reportWeek').value;
  const fileInput = document.getElementById('reportFile');
  const file = fileInput.files[0];
  if (!weekEnding || !file) {
    showMessage('submitMessage', 'Please select week ending and upload PDF', 'error');
    return;
  }
  if (file.type !== 'application/pdf') {
    showMessage('submitMessage', 'Only PDF files allowed', 'error');
    return;
  }
  const form = new FormData();
  form.append('weekEnding', weekEnding);
  form.append('file', file);
  try {
    setLoading(true);
    await apiFetch('/reports', { method: 'POST', body: form });
    showMessage('submitMessage', 'Report uploaded successfully!', 'success');
    showToast('Report uploaded', 'success');
    fileInput.value = '';
    await loadStaffReports();
  } catch (e) {
    showMessage('submitMessage', e.message, 'error');
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadStaffReports() {
  const container = document.getElementById('staffReports');
  try {
    const items = await apiFetch('/reports/mine');
    if (!items.length) {
      container.innerHTML = '<p>No reports yet.</p>';
      return;
    }
    container.innerHTML = items.map(r => `
      <div class="report-card">
        <div class="report-header">
          <h3>Week Ending: ${new Date(r.weekEnding).toISOString().split('T')[0]}</h3>
          <span class="status-badge status-${r.status.toLowerCase()}">${r.status.toLowerCase()}</span>
        </div>
        <a href="${r.filePath}" target="_blank" class="btn">View ${r.fileName}</a>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p class="error-message">${e.message}</p>`;
  }
}

/* ===== HOD Panel ===== */
function showHodSection(sectionId) {
  document.querySelectorAll('.hod-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`hod-${sectionId}`).classList.add('active');
  document.querySelectorAll('.hod-sidebar li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
}

async function loadHodDashboard() {
  document.getElementById('dashboard').classList.add('active');
  document.getElementById('hodDashboard').style.display = 'flex';
  setLoading(true);
  try {
    const tasks = [updateHodStats(), loadHodReports(), loadHodStaff()];
    const all = Promise.allSettled(tasks);
    const timeout = new Promise(resolve => setTimeout(resolve, 8000));
    await Promise.race([all, timeout]);
  } finally {
    setLoading(false);
  }
}

async function updateHodStats() {
  try {
    const items = await apiFetch('/hod/reports');
    const total = items.length;
    const approved = items.filter(r => r.status === 'APPROVED').length;
    const rejected = items.filter(r => r.status === 'REJECTED').length;
    const pending = items.filter(r => r.status === 'SUBMITTED').length;
    document.getElementById('hodTotal').textContent = total;
    document.getElementById('hodApproved').textContent = approved;
    document.getElementById('hodPending').textContent = pending;
    document.getElementById('hodRejected').textContent = rejected;
  } catch (_) {}
}

async function loadHodReports() {
  const container = document.getElementById('hodReportsList');
  try {
    const items = await apiFetch('/hod/reports');
    if (!items.length) {
      container.innerHTML = '<p>No reports yet.</p>';
      return;
    }
    container.innerHTML = items.map(r => `
      <div class="hod-report-card">
        <h4>${r.staff?.name || r.staffId}</h4>
        <p>Week Ending: ${new Date(r.weekEnding).toISOString().split('T')[0]}</p>
        <div>
          <button class="btn" onclick="approveReport(${r.id})">Approve</button>
          <button class="btn" onclick="rejectReport(${r.id})">Reject</button>
          <a href="${r.filePath}" target="_blank" class="btn">View</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p class="error-message">${e.message}</p>`;
  }
}

async function loadHodStaff() {
  const container = document.getElementById('hodStaffList');
  try {
    const staff = await apiFetch('/hod/staff');
    if (!staff.length) {
      container.innerHTML = '<p>No staff yet.</p>';
      return;
    }
    container.innerHTML = staff.map(s => `
      <div class="hod-staff-card">
        <h4>${s.name}</h4>
        <p>${s.email}</p>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p class="error-message">${e.message}</p>`;
  }
}

async function approveReport(id) {
  try {
    await apiFetch(`/hod/reports/${id}/approve`, { method: 'POST' });
    await Promise.all([loadHodReports(), updateHodStats()]);
  } catch (_) {}
}
async function rejectReport(id) {
  try {
    await apiFetch(`/hod/reports/${id}/reject`, { method: 'POST' });
    await Promise.all([loadHodReports(), updateHodStats()]);
  } catch (_) {}
}

// Session restore
(function init() {
  // theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  if (currentUser && authToken) {
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userBadge').textContent = `${currentUser.name} (${currentUser.role.toLowerCase()})`;
    if (currentUser.role === 'STAFF') {
      document.getElementById('staffDashboard').style.display = 'block';
      loadStaffReports();
    } else if (currentUser.role === 'HOD') {
      document.getElementById('staffDashboard').style.display = 'none';
      loadHodDashboard();
    }
  } else {
    document.getElementById('landingSection').classList.add('active');
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
  }
})();
