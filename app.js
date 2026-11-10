// Shared utilities and API helper
const API = {
  async get(url) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async delete(url) {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  }
};

// Check current user session
async function checkAuth(redirectIfNotAuth = true) {
  try {
    const data = await API.get('/api/auth/me');
    if (!data.success && redirectIfNotAuth) {
      window.location.href = '/login.html';
      return null;
    }
    return data.user;
  } catch (err) {
    if (redirectIfNotAuth) window.location.href = '/login.html';
    return null;
  }
}

// Show alert message
function showAlert(elId, message, type = 'error') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}
