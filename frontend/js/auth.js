/**
 * auth.js
 * Client-side auth utilities: token check, redirect, logout, API headers
 * Must be loaded first on all pages.
 */

(function () {
  const TOKEN_KEY = 'authToken';
  const PUBLIC_PAGES = ['login.html', 'register.html', 'login', 'register'];

  /**
   * Check if current page is public (login/register)
   */
  function isPublicPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    if (page === '' || page === '/') return true; // root redirects to login
    return PUBLIC_PAGES.some(p => page === p || page.endsWith(p));
  }

  /**
   * Get stored auth token
   */
  window.getAuthToken = function () {
    return localStorage.getItem(TOKEN_KEY);
  };

  /**
   * Get Authorization header for API calls
   */
  window.getAuthHeaders = function (additionalHeaders = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { ...additionalHeaders };
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  };

  /**
   * Check if user is logged in
   */
  window.isLoggedIn = function () {
    return !!localStorage.getItem(TOKEN_KEY);
  };

  /**
   * Logout - clear token and redirect to login
   */
  window.logout = function () {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = 'login.html';
  };

  /**
   * Store token after successful login/register
   */
  window.setAuthToken = function (token) {
    localStorage.setItem(TOKEN_KEY, token);
  };

  // Run redirect logic on load
  document.addEventListener('DOMContentLoaded', function () {
    const loggedIn = window.isLoggedIn();
    const publicPage = isPublicPage();

    if (publicPage && loggedIn) {
      // Already logged in, redirect to upload
      window.location.href = 'upload.html';
      return;
    }
    if (!publicPage && !loggedIn) {
      // Not logged in, redirect to login
      window.location.href = 'login.html';
      return;
    }

    // Bind logout button if present
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', window.logout);
  });
})();
