/**
 * register.js
 * Handles registration form submission
 */

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('registerForm');
  const registerBtn = document.getElementById('registerBtn');
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
      if (username.length < 2) {
        showError('ユーザー名は2文字以上で入力してください。');
        return;
      }
      if (password.length < 6) {
        showError('パスワードは6文字以上で入力してください。');
        return;
      }

      if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.textContent = '登録中...';
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showError(data.error?.message || '登録に失敗しました。');
          if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = '登録';
          }
          return;
        }

        if (data.token) {
          window.setAuthToken(data.token);
          window.location.href = 'upload.html';
        }
      } catch (err) {
        console.error('Register error:', err);
        showError('登録に失敗しました。ネットワークを確認してください。');
        if (registerBtn) {
          registerBtn.disabled = false;
          registerBtn.textContent = '登録';
        }
      }
    });
  }
});
