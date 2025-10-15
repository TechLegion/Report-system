// Company's Report Management System - Enhanced Frontend
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000/api' : '/api';
let authToken = localStorage.getItem('authToken') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let notifications = [];
let dashboardData = null;

// Global state management
const state = {
  currentTab: 'overview',
  currentHodSection: 'overview',
  reports: [],
  filteredReports: [],
  notifications: [],
  departments: [],
  analytics: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  }
};

function setSession(token, user) {
  authToken = token;
  currentUser = user;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    updateUserInterface();
    // Show dashboard and hide login/register forms
    document.getElementById('landingSection').classList.remove('active');
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    
    // Load appropriate dashboard
    if (user.role === 'STAFF') {
      document.getElementById('staffDashboard').style.display = 'block';
      loadStaffDashboard();
    } else if (user.role === 'HOD') {
      document.getElementById('staffDashboard').style.display = 'none';
      loadHodDashboard();
    }
  } else {
    localStorage.removeItem('currentUser');
    // Show login form and hide dashboard
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('landingSection').classList.add('active');
  }
}

function updateUserInterface() {
  if (currentUser) {
    document.getElementById('userBadge').textContent = `${currentUser.name} (${currentUser.role.toLowerCase()})`;
    document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=4f46e5&color=fff`;
    if (currentUser.department) {
      document.getElementById('departmentBadge').textContent = currentUser.department.name;
    }
  }
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
  
  if (!res.ok) {
    if (res.status === 401) {
      // Token expired, redirect to login
      setSession(null, null);
      showLogin();
      throw new Error('Session expired. Please login again.');
    }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  
  return data;
}



// Enhanced loading states
function setLoading(isLoading, element = null) {
  const overlay = document.getElementById('loadingOverlay');
  if (isLoading) {
    overlay.style.display = 'flex';
    if (element) {
      element.disabled = true;
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }
  } else {
    overlay.style.display = 'none';
    if (element) {
      element.disabled = false;
      element.innerHTML = element.getAttribute('data-original-text') || 'Submit';
    }
  }
}

/* ===== UI helpers ===== */
function showLogin() {
  document.getElementById('landingSection').classList.remove('active');
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('registerForm').classList.remove('active');
  document.getElementById('dashboard').classList.remove('active');
  clearMessages();
}

function showRegister() {
  document.getElementById('landingSection').classList.remove('active');
  document.getElementById('registerForm').classList.add('active');
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('dashboard').classList.remove('active');
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
  setTimeout(() => (container.innerHTML = ''), 5000);
}

// Enhanced toast notifications
function showToast(message, kind = 'success', duration = 5000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${getToastIcon(kind)}"></i>
      <span>${message}</span>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function getToastIcon(kind) {
  const icons = {
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  return icons[kind] || 'info-circle';
}

// Notification management
function toggleNotifications() {
  const panel = document.getElementById('notificationPanel');
  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    loadNotifications();
  }
}

async function loadNotifications() {
  try {
    const response = await apiFetch('/notifications?limit=10');
    state.notifications = response.notifications;
    renderNotifications(response.notifications);
    updateNotificationBadge(response.unreadCount);
  } catch (error) {
    console.error('Failed to load notifications:', error);
  }
}

function renderNotifications(notifications) {
  const container = document.getElementById('notificationList');
  if (!notifications.length) {
    container.innerHTML = '<div class="notification-item"><p>No notifications</p></div>';
    return;
  }
  
  container.innerHTML = notifications.map(notification => `
    <div class="notification-item ${notification.isRead ? '' : 'unread'}" onclick="markNotificationRead(${notification.id})">
      <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
      <div class="notification-content">
        <p><strong>${notification.title}</strong></p>
        <p>${notification.message}</p>
        <div class="notification-time">${formatTime(notification.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function getNotificationIcon(type) {
  const icons = {
    REPORT_SUBMITTED: 'file-alt',
    REPORT_APPROVED: 'check-circle',
    REPORT_REJECTED: 'times-circle',
    REPORT_COMMENT: 'comment',
    SYSTEM_ANNOUNCEMENT: 'bullhorn',
    DEADLINE_REMINDER: 'clock'
  };
  return icons[type] || 'info-circle';
}

async function markNotificationRead(notificationId) {
  try {
    await apiFetch(`/notifications/${notificationId}/read`, { method: 'PUT' });
    loadNotifications();
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiFetch('/notifications/mark-all-read', { method: 'PUT' });
    loadNotifications();
    showToast('All notifications marked as read', 'success');
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
  }
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notificationBadge');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'block' : 'none';
}

// User menu management
function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.classList.toggle('show');
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-profile')) {
    document.getElementById('userMenu').classList.remove('show');
  }
  if (!e.target.closest('.notification-btn')) {
    document.getElementById('notificationPanel').classList.remove('show');
  }
});

// Theme handling
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Utility functions
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ===== Enhanced Auth ===== */
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
  
  if (password.length < 8) {
    showMessage('registerMessage', 'Password must be at least 8 characters', 'error');
    return;
  }
  
  if (password !== confirm) {
    showMessage('registerMessage', 'Passwords do not match', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showMessage('registerMessage', 'Please enter a valid email address', 'error');
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
    
    // Hide login forms and show dashboard
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('landingSection').classList.remove('active');
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';

    // Load appropriate dashboard
    if (currentUser.role === 'STAFF') {
      document.getElementById('staffDashboard').style.display = 'block';
      document.getElementById('hodDashboard').style.display = 'none';
      await loadStaffDashboard();
    } else if (['HOD', 'ADMIN', 'HR'].includes(currentUser.role)) {
      document.getElementById('staffDashboard').style.display = 'none';
      document.getElementById('hodDashboard').style.display = 'flex';
      await loadHodDashboard();
    }
    
    showToast(`Welcome back, ${currentUser.name}!`, 'success');
    
    // Load notifications count
    loadNotifications();
    
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
  document.getElementById('landingSection').classList.add('active');
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  showToast('Logged out successfully', 'info');
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/* ===== Enhanced Tabs ===== */
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tabId).classList.add('active');

  state.currentTab = tabId;

  // Load appropriate content based on tab
  switch(tabId) {
    case 'overview':
      loadOverviewData();
      break;
    case 'myreports':
      loadStaffReports();
      break;
    case 'analytics':
      loadStaffAnalytics();
      break;
  }
}

/* ===== Enhanced Report Management ===== */
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

// Enhanced file upload handling
document.getElementById('reportFile').addEventListener('change', function(e) {
  const file = e.target.files[0];
  const fileInfo = document.getElementById('fileInfo');
  
  if (file) {
    fileInfo.innerHTML = `
      <div class="file-details">
        <i class="fas fa-file-pdf"></i>
        <div>
          <strong>${file.name}</strong>
          <span>${formatFileSize(file.size)}</span>
        </div>
      </div>
    `;
    fileInfo.classList.add('show');
  } else {
    fileInfo.innerHTML = '';
    fileInfo.classList.remove('show');
  }
});

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

function renderReports(reports) {
  const container = document.getElementById('staffReports');
  
  container.innerHTML = reports.map(report => `
    <div class="report-card" onclick="showReportDetails(${report.id})">
        <div class="report-header">
        <h3>${report.title}</h3>
        <span class="status-badge status-${report.status.toLowerCase().replace('_', '-')}">
          ${report.status.replace('_', ' ').toLowerCase()}
        </span>
      </div>
      <div class="report-meta">
        <p><i class="fas fa-calendar"></i> Week Ending: ${new Date(report.weekEnding).toLocaleDateString()}</p>
        <p><i class="fas fa-file-pdf"></i> ${report.fileName}</p>
        <p><i class="fas fa-clock"></i> Submitted: ${formatTime(report.createdAt)}</p>
        </div>
      <div class="report-actions">
        <button class="btn btn-secondary" onclick="event.stopPropagation(); downloadReport(${report.id})">
          <i class="fas fa-download"></i> Download
        </button>
        ${report.status === 'DRAFT' ? `
          <button class="btn btn-primary" onclick="event.stopPropagation(); editReport(${report.id})">
            <i class="fas fa-edit"></i> Edit
          </button>
        ` : ''}
        ${report._count?.comments > 0 ? `
          <span class="comment-count">
            <i class="fas fa-comments"></i> ${report._count.comments}
          </span>
        ` : ''}
      </div>
      </div>
    `).join('');
}

function filterReports() {
  const searchTerm = document.getElementById('reportsSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  
  let filtered = state.reports;
  
  if (searchTerm) {
    filtered = filtered.filter(report => 
      report.title.toLowerCase().includes(searchTerm) ||
      report.fileName.toLowerCase().includes(searchTerm)
    );
  }
  
  if (statusFilter) {
    filtered = filtered.filter(report => report.status === statusFilter);
  }
  
  state.filteredReports = filtered;
  renderReports(filtered);
}

function refreshReports() {
  loadStaffReports();
  showToast('Reports refreshed', 'success');
}

/* ===== Enhanced HOD Panel ===== */
function showHodSection(sectionId) {
  document.querySelectorAll('.hod-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`hod-${sectionId}`).classList.add('active');
  document.querySelectorAll('.hod-sidebar li').forEach(li => li.classList.remove('active'));
  event.target.classList.add('active');
  
  state.currentHodSection = sectionId;

  // Load appropriate content based on section
  switch(sectionId) {
    case 'overview':
      loadHodOverview();
      break;
    case 'reports':
      loadHodReports();
      break;
    case 'staff':
      loadHodStaff();
      break;
    case 'analytics':
      loadHodAnalytics();
      break;
  }
}

async function loadHodDashboard() {
  document.getElementById('dashboard').classList.add('active');
  document.getElementById('hodDashboard').style.display = 'flex';
  
  try {
    setLoading(true);
    await Promise.all([
      loadHodOverview(),
      loadNotifications()
    ]);
  } catch (error) {
    console.error('Failed to load HOD dashboard:', error);
    showToast('Failed to load dashboard data', 'error');
  } finally {
    setLoading(false);
  }
}

async function loadHodOverview() {
  try {
    const [analytics, recentReports] = await Promise.all([
      apiFetch('/dashboard/analytics'),
      apiFetch('/reports?limit=5')
    ]);
    
    // Update stats
    document.getElementById('hodTotal').textContent = analytics.summary.totalReports;
    document.getElementById('hodApproved').textContent = analytics.summary.approvedReports;
    document.getElementById('hodPending').textContent = analytics.summary.pendingReports;
    document.getElementById('hodRejected').textContent = analytics.summary.rejectedReports;
    
    // Update recent reports
    renderRecentReportsOverview(recentReports.reports || []);
    
    // Update team performance
    renderTeamPerformance(analytics.charts.topPerformers || []);
    
  } catch (error) {
    console.error('Failed to load HOD overview:', error);
  }
}

function renderRecentReportsOverview(reports) {
  const container = document.getElementById('recentReportsOverview');
  
  if (!reports.length) {
    container.innerHTML = '<p class="text-muted">No recent reports</p>';
    return;
  }
  
  container.innerHTML = reports.map(report => `
    <div class="recent-item" onclick="showReportDetails(${report.id})">
      <div class="recent-item-header">
        <span class="status-badge status-${report.status.toLowerCase().replace('_', '-')}">
          ${report.status.replace('_', ' ').toLowerCase()}
        </span>
        <span class="recent-time">${formatTime(report.createdAt)}</span>
      </div>
      <h4>${report.title}</h4>
      <p>by ${report.staff.name}</p>
    </div>
  `).join('');
}

function renderTeamPerformance(performers) {
  const container = document.getElementById('teamPerformance');
  
  if (!performers.length) {
    container.innerHTML = '<p class="text-muted">No performance data available</p>';
    return;
  }
  
  container.innerHTML = performers.map(performer => `
    <div class="performance-item">
      <div class="performer-info">
        <strong>${performer.name}</strong>
        <span>${performer.department?.name || 'No Department'}</span>
      </div>
      <div class="performance-metric">
        <span class="metric-value">${performer._count.reports}</span>
        <span class="metric-label">Approved Reports</span>
      </div>
    </div>
  `).join('');
}

async function loadHodReports() {
  const container = document.getElementById('hodReportsList');
  
  try {
    setLoading(true);
    const items = await apiFetch('/hod/reports');
    
    if (!items.length) {
      container.innerHTML = '<p>No reports yet.</p>';
      return;
    }
    
    container.innerHTML = items.map(r => `
      <div class="hod-report-card">
        <h4>${r.staff?.name || r.staffId}</h4>
        <p>Week Ending: ${new Date(r.weekEnding).toISOString().split('T')[0]}</p>
        <p>File: ${r.fileName}</p>
        <div>
          <button class="btn" onclick="approveReport(${r.id})">Approve</button>
          <button class="btn" onclick="rejectReport(${r.id})">Reject</button>
          <a href="${r.filePath}" target="_blank" class="btn">View</a>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    container.innerHTML = `<p class="error-message">${error.message}</p>`;
  } finally {
    setLoading(false);
  }
}

function renderHodReports(reports) {
  const container = document.getElementById('hodReportsList');
  
  container.innerHTML = reports.map(report => `
    <div class="report-card" onclick="showReportDetails(${report.id})">
      <div class="report-header">
        <h3>${report.title}</h3>
        <span class="status-badge status-${report.status.toLowerCase().replace('_', '-')}">
          ${report.status.replace('_', ' ').toLowerCase()}
        </span>
      </div>
      <div class="report-meta">
        <p><i class="fas fa-user"></i> ${report.staff.name}</p>
        <p><i class="fas fa-calendar"></i> Week Ending: ${new Date(report.weekEnding).toLocaleDateString()}</p>
        <p><i class="fas fa-clock"></i> Submitted: ${formatTime(report.createdAt)}</p>
      </div>
      <div class="report-actions">
        <button class="btn btn-success" onclick="event.stopPropagation(); updateReportStatus(${report.id}, 'APPROVED')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="btn btn-error" onclick="event.stopPropagation(); updateReportStatus(${report.id}, 'REJECTED')">
          <i class="fas fa-times"></i> Reject
        </button>
        <button class="btn btn-secondary" onclick="event.stopPropagation(); downloadReport(${report.id})">
          <i class="fas fa-download"></i> Download
        </button>
        ${report._count?.comments > 0 ? `
          <span class="comment-count">
            <i class="fas fa-comments"></i> ${report._count.comments}
          </span>
        ` : ''}
        </div>
      </div>
    `).join('');
}

async function loadHodStaff() {
  const container = document.getElementById('hodStaffList');
  
  try {
    const response = await apiFetch('/departments');
    const department = response.find(dept => dept.hod?.id === currentUser.id);
    
    if (!department || !department.staff.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <h3>No staff assigned</h3>
          <p>Staff members in your department will appear here</p>
        </div>
      `;
      return;
    }
    
    renderHodStaff(department.staff);
    
  } catch (error) {
    container.innerHTML = `<p class="error-message">Failed to load staff: ${error.message}</p>`;
  }
}

function renderHodStaff(staff) {
  const container = document.getElementById('hodStaffList');
  
  container.innerHTML = staff.map(member => `
    <div class="staff-card">
      <div class="staff-avatar">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=4f46e5&color=fff" alt="${member.name}">
      </div>
      <div class="staff-info">
        <h4>${member.name}</h4>
        <p>${member.email}</p>
        <span class="staff-role">${member.role.toLowerCase()}</span>
      </div>
      <div class="staff-stats">
        <div class="stat">
          <span class="stat-value">${member._count?.reports || 0}</span>
          <span class="stat-label">Reports</span>
        </div>
      </div>
      </div>
    `).join('');
}

async function updateReportStatus(reportId, status) {
  try {
    setLoading(true);
    await apiFetch(`/reports/${reportId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    
    showToast(`Report ${status.toLowerCase()} successfully`, 'success');
    await loadHodReports();
    await loadHodOverview();
    
  } catch (error) {
    showToast(`Failed to ${status.toLowerCase()} report: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function refreshHodDashboard() {
  loadHodOverview();
  showToast('Dashboard refreshed', 'success');
}

function refreshHodReports() {
  loadHodReports();
  showToast('Reports refreshed', 'success');
}

/* ===== Additional Functions ===== */

// Profile management
function showProfile() {
  const modal = document.getElementById('profileModal');
  document.getElementById('profileName').value = currentUser.name;
  document.getElementById('profileEmail').value = currentUser.email;
  document.getElementById('profilePhone').value = currentUser.phone || '';
  document.getElementById('profileDepartment').value = currentUser.department?.name || 'No Department';
  modal.style.display = 'flex';
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
}

async function updateProfile() {
  try {
    setLoading(true);
    const name = document.getElementById('profileName').value;
    const email = document.getElementById('profileEmail').value;
    const phone = document.getElementById('profilePhone').value;
    
    await apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email, phone })
    });
    
    // Update current user
    currentUser.name = name;
    currentUser.email = email;
    currentUser.phone = phone;
    setSession(authToken, currentUser);
    
    closeProfileModal();
    showToast('Profile updated successfully', 'success');
    
  } catch (error) {
    showToast(`Failed to update profile: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Password change
function showSettings() {
  showPasswordModal();
}

function showPasswordModal() {
  document.getElementById('passwordModal').style.display = 'flex';
}

function closePasswordModal() {
  document.getElementById('passwordModal').style.display = 'none';
  document.getElementById('passwordForm').reset();
}

async function changePassword() {
  try {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    
    setLoading(true);
    await apiFetch('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    closePasswordModal();
    showToast('Password changed successfully', 'success');
    
  } catch (error) {
    showToast(`Failed to change password: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

// Report details modal
async function showReportDetails(reportId) {
  try {
    setLoading(true);
    const report = await apiFetch(`/reports/${reportId}`);
    
    const modal = document.getElementById('reportModal');
    const title = document.getElementById('reportModalTitle');
    const body = document.getElementById('reportModalBody');
    const footer = document.getElementById('reportModalFooter');
    
    title.textContent = report.title;
    
    body.innerHTML = `
      <div class="report-details">
        <div class="detail-section">
          <h4>Report Information</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-badge status-${report.status.toLowerCase().replace('_', '-')}">
                ${report.status.replace('_', ' ').toLowerCase()}
              </span>
            </div>
            <div class="detail-item">
              <label>Week Ending:</label>
              <span>${new Date(report.weekEnding).toLocaleDateString()}</span>
            </div>
            <div class="detail-item">
              <label>Submitted by:</label>
              <span>${report.staff.name}</span>
            </div>
            <div class="detail-item">
              <label>Department:</label>
              <span>${report.department?.name || 'No Department'}</span>
            </div>
            <div class="detail-item">
              <label>File:</label>
              <span>${report.fileName} (${formatFileSize(report.fileSize)})</span>
            </div>
            <div class="detail-item">
              <label>Submitted:</label>
              <span>${formatTime(report.createdAt)}</span>
            </div>
          </div>
        </div>
        
        ${report.comments.length > 0 ? `
          <div class="detail-section">
            <h4>Comments (${report.comments.length})</h4>
            <div class="comments-list">
              ${report.comments.map(comment => `
                <div class="comment-item">
                  <div class="comment-header">
                    <strong>${comment.author.name}</strong>
                    <span class="comment-time">${formatTime(comment.createdAt)}</span>
                  </div>
                  <div class="comment-content">${comment.content}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${report.revisions.length > 0 ? `
          <div class="detail-section">
            <h4>Revisions (${report.revisions.length})</h4>
            <div class="revisions-list">
              ${report.revisions.map(revision => `
                <div class="revision-item">
                  <div class="revision-info">
                    <span>${revision.fileName}</span>
                    <span class="revision-time">${formatTime(revision.createdAt)}</span>
                  </div>
                  ${revision.revisionNote ? `<p class="revision-note">${revision.revisionNote}</p>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="closeReportModal()">Close</button>
      <button class="btn btn-primary" onclick="downloadReport(${reportId})">
        <i class="fas fa-download"></i> Download
      </button>
    `;
    
    modal.style.display = 'flex';
    
  } catch (error) {
    showToast(`Failed to load report details: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
}

// Download report
async function downloadReport(reportId) {
  try {
    const report = await apiFetch(`/reports/${reportId}`);
    const link = document.createElement('a');
    link.href = report.filePath;
    link.download = report.fileName;
    link.click();
  } catch (error) {
    showToast(`Failed to download report: ${error.message}`, 'error');
  }
}

// Staff dashboard functions
async function loadStaffDashboard() {
  await Promise.all([
    loadOverviewData(),
    loadStaffReports(),
    loadNotifications()
  ]);
}

async function loadOverviewData() {
  try {
    const [activity, notifications] = await Promise.all([
      apiFetch('/dashboard/activity'),
      apiFetch('/notifications?limit=5')
    ]);
    
    renderRecentActivity(activity);
    renderRecentNotifications(notifications.notifications);
    renderDashboardStats(activity);
    
  } catch (error) {
    console.error('Failed to load overview data:', error);
  }
}

function renderRecentActivity(activity) {
  const container = document.getElementById('recentActivity');
  container.innerHTML = `
    <div class="activity-item">
      <i class="fas fa-file-alt"></i>
      <div>
        <strong>${activity.reportsSubmitted} reports submitted</strong>
        <span>This month</span>
      </div>
    </div>
    <div class="activity-item">
      <i class="fas fa-check-circle"></i>
      <div>
        <strong>${activity.reportsApproved} reports approved</strong>
        <span>This month</span>
      </div>
    </div>
    <div class="activity-item">
      <i class="fas fa-comments"></i>
      <div>
        <strong>${activity.commentsMade} comments made</strong>
        <span>This month</span>
      </div>
    </div>
  `;
}

function renderRecentNotifications(notifications) {
  const container = document.getElementById('recentNotifications');
  
  if (!notifications.length) {
    container.innerHTML = '<p class="text-muted">No recent notifications</p>';
    return;
  }
  
  container.innerHTML = notifications.map(notification => `
    <div class="notification-item ${notification.isRead ? '' : 'unread'}" onclick="markNotificationRead(${notification.id})">
      <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
      <div>
        <strong>${notification.title}</strong>
        <span>${formatTime(notification.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

function renderDashboardStats(activity) {
  const container = document.getElementById('dashboardStats');
  container.innerHTML = `
    <div class="stat-item">
      <div class="stat-number">${activity.reportsSubmitted}</div>
      <div class="stat-label">Reports Submitted</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${activity.reportsApproved}</div>
      <div class="stat-label">Reports Approved</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${Math.round((activity.reportsApproved / Math.max(activity.reportsSubmitted, 1)) * 100)}%</div>
      <div class="stat-label">Approval Rate</div>
    </div>
  `;
}

async function loadStaffAnalytics() {
  // Placeholder for analytics functionality
  const container = document.getElementById('submissionChart');
  container.innerHTML = '<p class="text-muted">Analytics coming soon...</p>';
}

// Modal management
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// Check if session is still valid
async function validateSession() {
  if (!currentUser || !authToken) return false;
  
  try {
    const response = await apiFetch('/auth/profile');
    if (response) {
      // Update user data in case it changed
      currentUser = response;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      return true;
    }
  } catch (error) {
    // Session invalid, clear it
    setSession(null, null);
    return false;
  }
}

// Session restore and initialization
(async function init() {
  // Apply saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  
  // Hide all sections first
  document.getElementById('landingSection').classList.remove('active');
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('registerForm').classList.remove('active');
  document.getElementById('dashboard').classList.remove('active');
  
  // Restore session if available and valid
  if (currentUser && authToken && await validateSession()) {
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').style.display = 'flex';
    updateUserInterface();
    
    if (currentUser.role === 'STAFF') {
      document.getElementById('staffDashboard').style.display = 'block';
      loadStaffDashboard();
    } else if (currentUser.role === 'HOD') {
      document.getElementById('staffDashboard').style.display = 'none';
      loadHodDashboard();
    }
  } else {
    document.getElementById('landingSection').classList.add('active');
  }
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key) {
        case 'k':
          e.preventDefault();
          // Focus search
          const searchInput = document.getElementById('reportsSearch') || document.getElementById('hodReportsSearch');
          if (searchInput) searchInput.focus();
          break;
        case '/':
          e.preventDefault();
          // Toggle theme
          toggleTheme();
          break;
      }
    }
    
    if (e.key === 'Escape') {
      // Close any open modals
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
      });
    }
  });
  
  // Auto-refresh notifications every 30 seconds
  if (currentUser && authToken) {
    setInterval(() => {
      loadNotifications();
    }, 30000);
  }
})();
