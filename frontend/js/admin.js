/**
 * admin.js
 * Admin panel: sidebar toggle, history (mock), user management
 */

const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function () {
  // Admin-only: check token and role
  const token = window.getAuthToken && window.getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'admin') {
      alert('管理者のみアクセスできます。');
      window.location.href = 'upload.html';
      return;
    }
  } catch (e) {
    window.location.href = 'login.html';
    return;
  }

  // Sidebar toggle
  const layout = document.getElementById('adminLayout');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle && layout) {
    toggle.addEventListener('click', function () {
      layout.classList.toggle('admin-sidebar--closed');
    });
  }

  // Panel navigation
  document.querySelectorAll('.admin-sidebar__link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const panel = this.getAttribute('data-panel');
      document.querySelectorAll('.admin-sidebar__link').forEach(function (l) { l.classList.remove('active'); });
      this.classList.add('active');
      document.getElementById('panelHistory').style.display = panel === 'history' ? 'block' : 'none';
      document.getElementById('panelUsers').style.display = panel === 'users' ? 'block' : 'none';
      if (panel === 'users') loadUsers();
    });
  });

  // 新規ユーザー追加フォーム
  var addUserForm = document.getElementById('addUserForm');
  if (addUserForm) {
    addUserForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var username = document.getElementById('newUsername').value.trim();
      var password = document.getElementById('newPassword').value;
      var role = document.getElementById('newRole').value;
      var btn = document.getElementById('addUserBtn');
      if (!username || username.length < 2) {
        alert('ユーザー名は2文字以上で入力してください。');
        return;
      }
      if (!password || password.length < 6) {
        alert('パスワードは6文字以上で入力してください。');
        return;
      }
      if (btn) btn.disabled = true;
      var headers = window.getAuthHeaders ? window.getAuthHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
      fetch(API_BASE + '/admin/users', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ username: username, password: password, role: role })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error && data.error.message || '追加に失敗しました');
            return data;
          });
        })
        .then(function () {
          document.getElementById('newUsername').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('newRole').value = 'user';
          loadUsers();
        })
        .catch(function (err) { alert(err.message); })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  }

  // Logout
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', function () { window.logout(); });

  // Mock history data
  var mockHistory = [
    { date: '2026-01-28 14:30', user: 'user1', store: 'サンプルスーパー', amount: '1,510' },
    { date: '2026-01-27 10:15', user: 'admin', store: 'コンビニA', amount: '890' },
    { date: '2026-01-26 18:00', user: 'user2', store: 'レストランB', amount: '2,200' }
  ];

  var tbody = document.getElementById('historyTableBody');
  if (tbody) {
    tbody.innerHTML = mockHistory.map(function (row) {
      return '<tr>' +
        '<td>' + row.date + '</td>' +
        '<td>' + row.user + '</td>' +
        '<td>' + row.store + '</td>' +
        '<td>' + row.amount + ' 円</td>' +
        '<td><button type="button" class="btn btn-secondary btn-small" disabled>写真ダウンロード（仮）</button></td>' +
        '</tr>';
    }).join('');
  }

  function loadUsers() {
    var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
    fetch(API_BASE + '/admin/users', { headers: headers })
      .then(function (res) {
        if (res.status === 403) {
          document.getElementById('usersMessage').textContent = '管理者権限がありません。';
          return null;
        }
        if (!res.ok) throw new Error('取得に失敗しました');
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        document.getElementById('usersMessage').textContent = '';
        renderUsers(data.users);
      })
      .catch(function (err) {
        document.getElementById('usersMessage').textContent = err.message || 'ユーザー一覧の取得に失敗しました。';
        document.getElementById('usersTableBody').innerHTML = '';
      });
  }

  function renderUsers(users) {
    var currentUserId = null;
    try {
      var payload = JSON.parse(atob((window.getAuthToken && window.getAuthToken() || '').split('.')[1]));
      currentUserId = payload.userId;
    } catch (e) {}

    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = users.map(function (u) {
      var id = u._id;
      var isSelf = String(id) === String(currentUserId);
      var roleSelect = isSelf
        ? '<span class="admin-badge admin-badge--' + u.role + '">' + u.role + '</span>'
        : '<select class="user-role-select" data-id="' + id + '">' +
            '<option value="user"' + (u.role === 'user' ? ' selected' : '') + '>user</option>' +
            '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>admin</option>' +
          '</select>';
      var disabledBtn = u.disabled
        ? '<button type="button" class="btn btn-primary btn-small user-enable-btn" data-id="' + id + '">有効化</button>'
        : '<button type="button" class="btn btn-secondary btn-small user-disable-btn" data-id="' + id + '">無効化</button>';
      var deleteBtn = isSelf
        ? ''
        : '<button type="button" class="btn btn-secondary btn-small user-delete-btn" data-id="' + id + '">削除</button>';
      var state = u.disabled ? '<span class="admin-badge admin-badge--disabled">無効</span>' : '<span style="color:#059669;">有効</span>';
      var createdAt = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ja-JP') : '-';

      return '<tr>' +
        '<td>' + (u.username || '-') + '</td>' +
        '<td>' + roleSelect + '</td>' +
        '<td>' + createdAt + '</td>' +
        '<td>' + state + '</td>' +
        '<td class="admin-btn-group">' + (isSelf ? '-' : disabledBtn + deleteBtn) + '</td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('.user-role-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = this.getAttribute('data-id');
        var role = this.value;
        patchUser(id, { role: role });
      });
    });
    tbody.querySelectorAll('.user-disable-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('このユーザーを無効化しますか？')) return;
        patchUser(this.getAttribute('data-id'), { disabled: true });
      });
    });
    tbody.querySelectorAll('.user-enable-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        patchUser(this.getAttribute('data-id'), { disabled: false });
      });
    });
    tbody.querySelectorAll('.user-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('このユーザーを削除しますか？')) return;
        deleteUser(this.getAttribute('data-id'));
      });
    });
  }

  function patchUser(id, body) {
    var headers = window.getAuthHeaders ? window.getAuthHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
    fetch(API_BASE + '/admin/users/' + id, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error && d.error.message || '更新に失敗しました'); });
        return res.json();
      })
      .then(function () { loadUsers(); })
      .catch(function (err) { alert(err.message); });
  }

  function deleteUser(id) {
    var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
    fetch(API_BASE + '/admin/users/' + id, { method: 'DELETE', headers: headers })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.error && d.error.message || '削除に失敗しました'); });
        loadUsers();
      })
      .catch(function (err) { alert(err.message); });
  }
});
