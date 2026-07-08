/* ══════════════════════════════════════════════════════════════
   ADMIN.JS — Panel de administración del laboratorio
   ══════════════════════════════════════════════════════════════ */

const Admin = (() => {

  const TOKEN_KEY = 'sds_admin_token';
  const STATUS_LABELS = {
    pendiente:  'Pendiente',
    proceso:    'En proceso',
    revision:   'En revisión',
    completado: 'Completado',
  };

  /* ── Token ─────────────────────────────────────────────────── */
  function saveToken(tk) { sessionStorage.setItem(TOKEN_KEY, tk); }
  function getToken()    { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  function clearToken()  { sessionStorage.removeItem(TOKEN_KEY); }

  /* ── API ───────────────────────────────────────────────────── */
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(path, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: {} };
    }
  }

  /* ── State ─────────────────────────────────────────────────── */
  let users = [], orders = [], notifs = [];

  /* ══ LOGIN ═════════════════════════════════════════════════ */
  function initLogin() {
    if (getToken()) checkAndEnter();

    const form    = document.getElementById('adminLoginForm');
    const errBox  = document.getElementById('adminLoginError');
    const btnText = document.getElementById('adminLoginBtnText');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errBox.style.display = 'none';
      btnText.textContent = 'Verificando…';
      const r = await api('POST', '/api/admin/login', { password: form.password.value });
      if (r.ok) {
        saveToken(r.data.token);
        btnText.textContent = 'Entrando…';
        setTimeout(() => { window.location.href = 'admin.html'; }, 300);
      } else {
        btnText.textContent = 'Acceder';
        errBox.style.display = 'block';
      }
    });
  }

  async function checkAndEnter() {
    const r = await api('GET', '/api/admin/users');
    if (r.ok) window.location.href = 'admin.html';
    else clearToken();
  }

  /* ══ DASHBOARD ═════════════════════════════════════════════ */
  async function initDashboard() {
    if (!getToken()) return goLogin();

    /* Verificar token */
    const check = await api('GET', '/api/admin/users');
    if (!check.ok) return goLogin();

    await loadAll();
    renderSummary();
    renderUsersTab();
    renderOrdersTab();
    renderNotifsTab();
    initTabs();
    initLogout();
    initModals();
  }

  async function loadAll() {
    const [uR, oR, nR] = await Promise.all([
      api('GET', '/api/admin/users'),
      api('GET', '/api/admin/orders'),
      api('GET', '/api/admin/notifications'),
    ]);
    users  = uR.ok ? uR.data  : [];
    orders = oR.ok ? oR.data  : [];
    notifs = nR.ok ? nR.data  : [];
  }

  function goLogin() {
    clearToken();
    window.location.href = 'admin-login.html';
  }

  /* ── Summary ─────────────────────────────────────────────── */
  function renderSummary() {
    setText('sumUsers',     users.length);
    setText('sumOrders',    orders.length);
    setText('sumProceso',   orders.filter(o => o.status === 'proceso').length);
    setText('sumPendiente', orders.filter(o => o.status === 'pendiente').length);
    setText('tabUsersCount',  users.length);
    setText('tabOrdersCount', orders.length);
    setText('tabNotifsCount', notifs.length);
  }

  /* ── Tabs ─────────────────────────────────────────────────── */
  function initTabs() {
    document.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  /* ── Logout ──────────────────────────────────────────────── */
  function initLogout() {
    const btn = document.getElementById('adminLogoutBtn');
    if (btn) btn.addEventListener('click', () => {
      clearToken();
      window.location.href = 'admin-login.html';
    });
  }

  /* ══ USERS TAB ════════════════════════════════════════════ */
  function renderUsersTab() {
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Sin clientes registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr data-id="${u.id}">
        <td><span class="admin-id">${u.id}</span></td>
        <td>
          <div>${u.name}</div>
          <div class="admin-muted">${u.clinic || '—'}</div>
        </td>
        <td class="admin-muted">${u.username || '—'}</td>
        <td class="admin-muted">${u.phone || '—'}</td>
        <td class="admin-muted">${u.since || '—'}</td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" onclick="Admin.openUserFiles('${u.id}')" title="Archivos">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
            </button>
            <button class="btn-icon" onclick="Admin.openEditUser('${u.id}')" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon danger" onclick="Admin.deleteUser('${u.id}')" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* ══ ORDERS TAB ═══════════════════════════════════════════ */
  function renderOrdersTab() {
    const tbody = document.getElementById('ordersBody');
    if (!tbody) return;
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Sin trabajos registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr data-id="${o.id}">
        <td><span class="admin-id">${o.ref}</span></td>
        <td>
          <div style="font-size:0.82rem">${o.userName || '—'}</div>
          <div class="admin-muted">${o.userClinic || '—'}</div>
        </td>
        <td>
          <div style="font-size:0.82rem">${o.type}</div>
          <div class="admin-muted">${o.desc}</div>
        </td>
        <td class="admin-muted">${o.date}</td>
        <td class="admin-muted">${o.eta}</td>
        <td>
          <select class="status-select" onchange="Admin.updateOrderStatus('${o.id}', this.value)">
            ${Object.entries(STATUS_LABELS).map(([v, l]) => `<option value="${v}"${o.status === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" onclick="Admin.openEditOrder('${o.id}')" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon danger" onclick="Admin.deleteOrder('${o.id}')" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* ══ NOTIFICATIONS TAB ════════════════════════════════════ */
  function renderNotifsTab() {
    /* Populate user select */
    const sel = document.getElementById('notifUserSelect');
    if (sel) {
      sel.innerHTML = `<option value="" disabled selected>Seleccionar cliente…</option>` +
        users.map(u => `<option value="${u.id}">${u.name} · ${u.clinic}</option>`).join('');
    }

    const tbody = document.getElementById('notifsBody');
    if (!tbody) return;
    if (!notifs.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Sin notificaciones.</td></tr>`;
      return;
    }
    tbody.innerHTML = notifs.map(n => `
      <tr>
        <td><span class="admin-muted" style="font-size:0.72rem">${fmtDate(n.createdAt)} ${n.time}</span></td>
        <td>${n.userName || '—'}</td>
        <td>${n.text}</td>
        <td>
          <span class="badge ${n.read ? 'badge-completado' : 'badge-proceso'}" style="font-size:0.6rem">
            ${n.read ? 'Leída' : 'No leída'}
          </span>
        </td>
        <td>
          <button class="btn-icon danger" onclick="Admin.deleteNotif('${n.id}')" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
      </tr>`).join('');
  }

  /* ══ MODALS ════════════════════════════════════════════════ */
  function initModals() {
    /* Close on overlay click */
    document.querySelectorAll('.admin-modal-overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) closeModals(); });
    });
    document.querySelectorAll('.admin-modal-cancel').forEach(btn => {
      btn.addEventListener('click', closeModals);
    });

    /* New user form */
    const newUserForm = document.getElementById('newUserForm');
    if (newUserForm) {
      newUserForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = newUserForm.querySelector('.admin-modal-submit');
        btn.textContent = 'Guardando…';
        const r = await api('POST', '/api/admin/users', {
          name:     newUserForm.uName.value,
          username: newUserForm.uUsername.value,
          email:    newUserForm.uEmail.value,
          password: newUserForm.uPassword.value || 'stratton2024',
          clinic:   newUserForm.uClinic.value,
          phone:    newUserForm.uPhone.value,
        });
        btn.textContent = 'Guardar cliente';
        if (r.ok) {
          closeModals();
          newUserForm.reset();
          await refresh();
          toast('Cliente creado correctamente.');
        } else {
          toast(r.data.error || 'Error al crear el cliente.');
        }
      });
    }

    /* Edit user form */
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
      editUserForm.addEventListener('submit', async e => {
        e.preventDefault();
        const id  = editUserForm.dataset.userId;
        const btn = editUserForm.querySelector('.admin-modal-submit');
        btn.textContent = 'Guardando…';
        const body = {
          name:     editUserForm.uName.value,
          username: editUserForm.uUsername.value,
          email:    editUserForm.uEmail.value,
          clinic:   editUserForm.uClinic.value,
          phone:    editUserForm.uPhone.value,
        };
        if (editUserForm.uPassword.value) body.password = editUserForm.uPassword.value;
        const r = await api('PUT', `/api/admin/users/${id}`, body);
        btn.textContent = 'Guardar cambios';
        if (r.ok) {
          closeModals();
          await refresh();
          toast('Cliente actualizado.');
        } else {
          toast(r.data.error || 'Error al actualizar.');
        }
      });
    }

    /* New order form */
    const newOrderForm = document.getElementById('newOrderForm');
    if (newOrderForm) {
      /* Populate user select */
      const uSel = newOrderForm.querySelector('[name="userId"]');
      if (uSel) {
        uSel.innerHTML = `<option value="" disabled selected>Seleccionar cliente…</option>` +
          users.map(u => `<option value="${u.id}">${u.name} · ${u.clinic}</option>`).join('');
      }
      newOrderForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = newOrderForm.querySelector('.admin-modal-submit');
        btn.textContent = 'Guardando…';
        const r = await api('POST', '/api/admin/orders', {
          userId: newOrderForm.userId.value,
          type:   newOrderForm.type.value,
          desc:   newOrderForm.desc.value,
          date:   newOrderForm.date.value,
          eta:    newOrderForm.eta.value,
          status: newOrderForm.status.value,
          notes:  newOrderForm.notes.value,
        });
        btn.textContent = 'Crear trabajo';
        if (r.ok) {
          closeModals();
          newOrderForm.reset();
          await refresh();
          toast('Trabajo creado correctamente.');
        } else {
          toast(r.data.error || 'Error al crear el trabajo.');
        }
      });
    }

    /* Edit order form */
    const editOrderForm = document.getElementById('editOrderForm');
    if (editOrderForm) {
      editOrderForm.addEventListener('submit', async e => {
        e.preventDefault();
        const id  = editOrderForm.dataset.orderId;
        const btn = editOrderForm.querySelector('.admin-modal-submit');
        btn.textContent = 'Guardando…';
        const r = await api('PUT', `/api/admin/orders/${id}`, {
          type:   editOrderForm.type.value,
          desc:   editOrderForm.desc.value,
          date:   editOrderForm.date.value,
          eta:    editOrderForm.eta.value,
          status: editOrderForm.status.value,
          notes:  editOrderForm.notes.value,
        });
        btn.textContent = 'Guardar cambios';
        if (r.ok) {
          closeModals();
          await refresh();
          toast('Trabajo actualizado.');
        } else {
          toast(r.data.error || 'Error al actualizar.');
        }
      });
    }

    /* Send notification form */
    const notifForm = document.getElementById('notifForm');
    if (notifForm) {
      notifForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = notifForm.querySelector('.btn-primary-sm');
        btn.textContent = 'Enviando…';
        const r = await api('POST', '/api/admin/notifications', {
          userId: document.getElementById('notifUserSelect').value,
          text:   document.getElementById('notifText').value,
        });
        btn.textContent = 'Enviar notificación';
        if (r.ok) {
          notifForm.reset();
          document.getElementById('notifText').value = '';
          document.getElementById('notifUserSelect').selectedIndex = 0;
          await refresh();
          toast('Notificación enviada.');
        } else {
          toast(r.data.error || 'Error al enviar.');
        }
      });
    }
  }

  function closeModals() {
    document.querySelectorAll('.admin-modal-overlay').forEach(m => m.classList.remove('open'));
  }

  /* ── Public: open new user ───────────────────────────────── */
  function openNewUser() {
    document.getElementById('newUserForm')?.reset();
    document.getElementById('newUserModal').classList.add('open');
  }

  /* ── Public: open edit user ──────────────────────────────── */
  function openEditUser(id) {
    const u = users.find(u => u.id === id);
    if (!u) return;
    const form = document.getElementById('editUserForm');
    form.dataset.userId    = id;
    form.uName.value       = u.name;
    form.uUsername.value   = u.username || '';
    form.uEmail.value      = u.email    || '';
    form.uClinic.value     = u.clinic   || '';
    form.uPhone.value      = u.phone    || '';
    form.uPassword.value   = '';
    document.getElementById('editUserModal').classList.add('open');
  }

  /* ── Public: delete user ─────────────────────────────────── */
  async function deleteUser(id) {
    if (!confirm('¿Eliminar este cliente? Se eliminarán también sus datos de sesión.')) return;
    const r = await api('DELETE', `/api/admin/users/${id}`);
    if (r.ok) { await refresh(); toast('Cliente eliminado.'); }
    else toast(r.data.error || 'Error al eliminar.');
  }

  /* ── Public: open new order ──────────────────────────────── */
  function openNewOrder() {
    document.getElementById('newOrderForm')?.reset();
    const uSel = document.querySelector('#newOrderForm [name="userId"]');
    if (uSel) {
      uSel.innerHTML = `<option value="" disabled selected>Seleccionar cliente…</option>` +
        users.map(u => `<option value="${u.id}">${u.name} · ${u.clinic}</option>`).join('');
    }
    document.getElementById('newOrderModal').classList.add('open');
  }

  /* ── Public: open edit order ─────────────────────────────── */
  function openEditOrder(id) {
    const o = orders.find(o => o.id === id);
    if (!o) return;
    const form = document.getElementById('editOrderForm');
    form.dataset.orderId = id;
    form.type.value      = o.type;
    form.desc.value      = o.desc;
    form.date.value      = o.date;
    form.eta.value       = o.eta === '—' ? '' : o.eta;
    form.status.value    = o.status;
    form.notes.value     = o.notes || '';
    document.getElementById('editOrderModal').classList.add('open');
  }

  /* ── Public: update order status inline ──────────────────── */
  async function updateOrderStatus(id, status) {
    const r = await api('PUT', `/api/admin/orders/${id}`, { status });
    if (r.ok) {
      const o = orders.find(o => o.id === id);
      if (o) o.status = status;
      renderSummary();
      toast('Estado actualizado.');
    } else {
      toast('Error al actualizar estado.');
    }
  }

  /* ── Public: delete order ────────────────────────────────── */
  async function deleteOrder(id) {
    if (!confirm('¿Eliminar este trabajo del historial?')) return;
    const r = await api('DELETE', `/api/admin/orders/${id}`);
    if (r.ok) { await refresh(); toast('Trabajo eliminado.'); }
    else toast(r.data.error || 'Error al eliminar.');
  }

  /* ── Public: delete notification ────────────────────────── */
  async function deleteNotif(id) {
    const r = await api('DELETE', `/api/admin/notifications/${id}`);
    if (r.ok) { await refresh(); toast('Notificación eliminada.'); }
    else toast(r.data.error || 'Error al eliminar.');
  }

  /* ══ ARCHIVOS DRIVE ══════════════════════════════════════ */
  let currentFilesUserId = '';

  async function openUserFiles(userId) {
    const u = users.find(u => u.id === userId);
    if (!u) return;
    currentFilesUserId = userId;
    setText('filesModalUserName', u.name);
    document.getElementById('adminFilesList').innerHTML =
      `<div class="admin-files-empty">Cargando…</div>`;
    document.getElementById('adminUploadProgress').style.display = 'none';
    document.getElementById('adminFileInput').value = '';
    document.getElementById('userFilesModal').classList.add('open');
    const r = await api('GET', `/api/admin/files/${userId}`);
    renderAdminFiles(r.ok ? r.data : []);
  }

  function renderAdminFiles(files) {
    const list = document.getElementById('adminFilesList');
    if (!list) return;
    if (!files.length) {
      list.innerHTML = `<div class="admin-files-empty">Sin archivos para este cliente.</div>`;
      return;
    }
    list.innerHTML = files.map(f => `
      <div class="admin-file-item">
        <div class="admin-file-info">
          <div class="admin-file-name">${f.name}</div>
          <div class="admin-file-meta">${fmtDate(f.createdTime)} · ${fmtSize(f.size || 0)}</div>
        </div>
        <a href="${f.webViewLink}" target="_blank" rel="noopener" class="admin-file-link">Ver en Drive</a>
      </div>`).join('');
  }

  async function uploadAdminFile() {
    const input    = document.getElementById('adminFileInput');
    const progress = document.getElementById('adminUploadProgress');
    if (!input.files.length) return toast('Selecciona un archivo primero.');
    progress.style.display = 'flex';
    let errors = 0;
    for (const file of input.files) {
      const data = await toBase64(file);
      const r    = await api('POST', `/api/admin/upload/${currentFilesUserId}`, {
        name: file.name, type: file.type, data,
      });
      if (!r.ok) { errors++; toast(r.data.error || 'Error al subir ' + file.name); }
    }
    progress.style.display = 'none';
    input.value = '';
    if (!errors) toast('Archivo(s) subido(s) correctamente.');
    const r = await api('GET', `/api/admin/files/${currentFilesUserId}`);
    renderAdminFiles(r.ok ? r.data : []);
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function fmtSize(bytes) {
    const n = parseInt(bytes) || 0;
    if (n < 1024)    return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  /* ── Refresh all data & re-render ────────────────────────── */
  async function refresh() {
    await loadAll();
    renderSummary();
    renderUsersTab();
    renderOrdersTab();
    renderNotifsTab();
  }

  /* ── Utils ───────────────────────────────────────────────── */
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '—';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function toast(msg) {
    let t = document.getElementById('adminToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  return {
    initLogin, initDashboard,
    openNewUser, openEditUser, deleteUser,
    openNewOrder, openEditOrder, updateOrderStatus, deleteOrder,
    deleteNotif,
    openUserFiles, uploadAdminFile,
  };
})();
