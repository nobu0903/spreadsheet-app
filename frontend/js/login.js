/**
 * login.js
 * Handles login form submission
 */

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const errorDiv = document.getElementById('errorMessage');

  function showError(msg) {
    if (errorDiv) {
      errorDiv.textContent = msg;
      errorDiv.style.display = 'block';
    }
  }

  function clearError() {
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }
  }

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearError();

      const username = document.getElementById('username')?.value?.trim();
      const password = document.getElementById('password')?.value;

      if (!username || !password) {
        showError('ユーザー名とパスワードを入力してください。');
        return;
      }

      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'ログイン中...';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showError(data.error?.message || 'ログインに失敗しました。');
          if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'ログイン';
          }
          return;
        }

        if (data.token) {
          window.setAuthToken(data.token);
          window.location.href = 'upload.html';
        }
      } catch (err) {
        console.error('Login error:', err);
        showError('ログインに失敗しました。ネットワークを確認してください。');
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = 'ログイン';
        }
      }
    });
  }
});
