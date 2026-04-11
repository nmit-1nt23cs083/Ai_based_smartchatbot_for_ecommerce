'use strict';

const API_BASE = 'http://localhost:3000/api';

// ─── Token Management ─────────────────────────────────────────────────────────

const Auth = {
  getToken: () => localStorage.getItem('trendify_token'),
  setToken: (t) => localStorage.setItem('trendify_token', t),
  removeToken: () => localStorage.removeItem('trendify_token'),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('trendify_user') || 'null'); }
    catch { return null; }
  },
  setUser: (u) => localStorage.setItem('trendify_user', JSON.stringify(u)),
  removeUser: () => localStorage.removeItem('trendify_user'),
  isLoggedIn: () => !!localStorage.getItem('trendify_token'),
  isAdmin: () => {
    const u = Auth.getUser();
    return u && u.role === 'admin';
  },
  logout: () => {
    Auth.removeToken();
    Auth.removeUser();
    updateNavUI();
  }
};

// ─── API Client ───────────────────────────────────────────────────────────────

async function apiRequest(method, endpoint, body = null, isFormData = false) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = isFormData ? body : JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    if (err.message.includes('fetch')) throw new Error('Cannot connect to server. Make sure backend is running.');
    throw err;
  }
}

const api = {
  get: (ep) => apiRequest('GET', ep),
  post: (ep, body) => apiRequest('POST', ep, body),
  put: (ep, body) => apiRequest('PUT', ep, body),
  delete: (ep) => apiRequest('DELETE', ep),
  postForm: (ep, formData) => apiRequest('POST', ep, formData, true),
  putForm: (ep, formData) => apiRequest('PUT', ep, formData, true),
};

// ─── Cart Count ───────────────────────────────────────────────────────────────

async function refreshCartCount() {
  if (!Auth.isLoggedIn()) {
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
    return;
  }
  try {
    const data = await api.get('/cart');
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = data.count || 0);
  } catch {}
}

// ─── Nav UI Update ────────────────────────────────────────────────────────────

function updateNavUI() {
  const user = Auth.getUser();
  const loginLink = document.getElementById('nav-login');
  const userMenu = document.getElementById('nav-user');
  const adminLink = document.getElementById('nav-admin');
  const userNameEl = document.getElementById('nav-user-name');

  if (user && Auth.isLoggedIn()) {
    if (loginLink) loginLink.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (userNameEl) userNameEl.textContent = user.name.split(' ')[0];
    if (adminLink) adminLink.style.display = user.role === 'admin' ? 'block' : 'none';
  } else {
    if (loginLink) loginLink.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// ─── User Behavior Tracking (for AI Recommendations) ─────────────────────────

const Tracking = {
  sessionId: localStorage.getItem('session_id') || (Math.random().toString(36).substr(2, 9)),
  
  init: () => {
    if (!localStorage.getItem('session_id')) {
      localStorage.setItem('session_id', Tracking.sessionId);
    }
  },

  logAction: async (action, targetType, targetId = null, targetName = null) => {
    try {
      // Don't block UI - send asynchronously
      await fetch(`${API_BASE}/traces`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': Auth.getToken() ? `Bearer ${Auth.getToken()}` : ''
        },
        body: JSON.stringify({
          action,
          target_type: targetType,
          target_id: targetId,
          target_name: targetName,
          page_url: window.location.pathname,
          session_id: Tracking.sessionId,
          user_agent: navigator.userAgent,
          ip_address: 'client'
        })
      }).catch(err => console.log('Tracking error:', err.message));
    } catch (err) {
      console.log('Tracking failed silently:', err.message);
    }
  },

  trackSearch: (query) => {
    Tracking.logAction('search', 'query', null, query);
  },

  trackProductView: (productId, productName) => {
    Tracking.logAction('view', 'product', productId, productName);
  },

  trackAddToCart: (productId, productName) => {
    Tracking.logAction('add_to_cart', 'product', productId, productName);
  },

  trackAddToWishlist: (productId, productName) => {
    Tracking.logAction('add_to_wishlist', 'product', productId, productName);
  },

  trackRemoveFromCart: (productId, productName) => {
    Tracking.logAction('remove_from_cart', 'product', productId, productName);
  },

  trackRemoveFromWishlist: (productId, productName) => {
    Tracking.logAction('remove_from_wishlist', 'product', productId, productName);
  }
};

// ─── Star Rating Helper ───────────────────────────────────────────────────────

function renderStars(rating, max = 5) {
  let html = '';
  for (let i = 1; i <= max; i++) {
    if (i <= Math.floor(rating)) html += '★';
    else if (i - 0.5 <= rating) html += '½';
    else html += '☆';
  }
  return `<span class="stars" title="${rating}/${max}">${html}</span>`;
}

// ─── Format Currency ──────────────────────────────────────────────────────────

function formatPrice(n) {
  return '₹' + parseFloat(n).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

// ─── Init on DOM Load ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  Tracking.init();
  updateNavUI();
  refreshCartCount();

  // Logout button
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
      window.location.href = '/index.html';
    });
  });
});
