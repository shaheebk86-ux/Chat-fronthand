document.addEventListener('DOMContentLoaded', () => {
  // Toggle password visibility
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.dataset.target;
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        e.target.textContent = 'Hide';
      } else {
        input.type = 'password';
        e.target.textContent = 'Show';
      }
    });
  });

  // Login Handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginIdentifier = document.getElementById('loginIdentifier').value;
      const password = document.getElementById('password').value;

      try {
        const res = await API.post('/api/auth/login', { loginIdentifier, password });
        if (res.success) {
          localStorage.setItem('duo_user', JSON.stringify(res.user));
          window.location.href = '/dashboard.html';
        } else {
          showAlert('auth-alert', res.message || 'Login failed');
        }
      } catch (err) {
        showAlert('auth-alert', 'Network or server error during login');
      }
    });
  }

  // Register Handler
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const email = document.getElementById('email').value;
      const displayName = document.getElementById('displayName').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        return showAlert('auth-alert', 'Passwords do not match');
      }

      try {
        const res = await API.post('/api/auth/register', {
          username,
          email,
          displayName,
          password,
          confirmPassword
        });

        if (res.success) {
          localStorage.setItem('duo_user', JSON.stringify(res.user));
          window.location.href = '/dashboard.html';
        } else {
          showAlert('auth-alert', res.message || 'Registration failed');
        }
      } catch (err) {
        showAlert('auth-alert', 'Network or server error during registration');
      }
    });
  }
});
