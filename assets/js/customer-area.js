/* ══════════════════════════════════════════════════════════════
   CUSTOMER-AREA.JS — Cliente del área privada
   Usa la API REST de server.js en lugar de datos estáticos
   ══════════════════════════════════════════════════════════════ */

const CA = (() => {

  const TOKEN_KEY  = 'sds_token';
  const STATUS_CFG = {
    proceso:    { label: 'En proceso',   cls: 'badge-proceso' },
    revision:   { label: 'En revisión',  cls: 'badge-revision' },
    completado: { label: 'Completado',   cls: 'badge-completado' },
    pendiente:  { label: 'Pendiente',    cls: 'badge-pendiente' },
  };

  /* ── Token helpers ─────────────────────────────────────────── */
  function saveToken(tk) { sessionStorage.setItem(TOKEN_KEY, tk); }
  function getToken()    { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  function clearToken()  { sessionStorage.removeItem(TOKEN_KEY); }

  /* ── API helper ────────────────────────────────────────────── */
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
      return { ok: false, status: 0, data: { error: 'No se puede conectar con el servidor. Accede desde http://localhost:3000' } };
    }
  }

  /* ══ LOGIN PAGE ════════════════════════════════════════════ */
  function initLogin() {
    /* Si ya hay sesión, ir al dashboard */
    if (getToken()) {
      api('GET', '/api/me').then(r => {
        if (r.ok) window.location.href = 'customer-dashboard.html';
      });
    }

    const form    = document.getElementById('loginForm');
    const errBox  = document.getElementById('loginError');
    const btnText = document.getElementById('loginBtnText');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.classList.remove('visible');
      btnText.textContent = 'Verificando…';

      const r = await api('POST', '/api/login', {
        username: form.username.value.trim(),
        password: form.password.value,
      });

      if (r.ok) {
        if (r.data.isAdmin) {
          sessionStorage.setItem('sds_admin_token', r.data.token);
          btnText.textContent = 'Panel admin…';
          setTimeout(() => { window.location.href = 'admin.html'; }, 300);
        } else {
          saveToken(r.data.token);
          btnText.textContent = '¡Bienvenido!';
          setTimeout(() => { window.location.href = 'customer-dashboard.html'; }, 400);
        }
      } else {
        btnText.textContent = 'Acceder al área privada';
        errBox.textContent = r.data.error || 'Credenciales incorrectas. Por favor, revise su usuario y contraseña.';
        errBox.classList.add('visible');
      }
    });

    cursorGlow();
  }

  /* ══ DASHBOARD PAGE ════════════════════════════════════════ */
  async function initDashboard() {
    if (!getToken()) return redirect();

    /* Cargar datos en paralelo */
    const [meR, ordersR, notifsR] = await Promise.all([
      api('GET', '/api/me'),
      api('GET', '/api/orders'),
      api('GET', '/api/notifications'),
    ]);

    if (!meR.ok) return redirect();

    const user   = meR.data;
    const orders = ordersR.ok ? ordersR.data : [];
    const notifs = notifsR.ok ? notifsR.data : [];

    renderProfile(user);
    renderStats(orders);
    renderOrders(orders);
    renderNotifs(notifs);
    initModal();
    initLogout();
    cursorGlow();
  }

  function redirect() {
    clearToken();
    window.location.href = 'customer-login.html';
  }

  /* ── Render helpers ─────────────────────────────────────── */
  function renderProfile(u) {
    setText('userInitials',   u.initials || initials(u.name));
    setText('userName',       u.name);
    setText('userClinic',     u.clinic);
    setText('welcomeName',    u.name);
    setText('profileInitials',u.initials || initials(u.name));
    setText('profileName',    u.name);
    setText('profileClinic',  u.clinic);
    setText('profileId',       'ID · ' + u.id);
    setText('profileUsername', u.username || '—');
    setText('profileEmail',    u.email || '—');
    setText('profilePhone',    u.phone || '—');
    setText('profileSince',   u.since || '—');
  }

  function renderStats(orders) {
    setText('statProceso',    orders.filter(o => o.status === 'proceso').length);
    setText('statRevision',   orders.filter(o => o.status === 'revision').length);
    setText('statCompletado', orders.filter(o => o.status === 'completado').length);
    setText('statTotal',      orders.length);
  }

  function renderOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    if (!tbody) return;
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--silver);padding:40px">No hay trabajos registrados aún.</td></tr>`;
      return;
    }
    tbody.innerHTML = orders.map(o => {
      const s = STATUS_CFG[o.status] || STATUS_CFG.pendiente;
      return `
        <tr>
          <td><span class="order-id">${o.ref}</span></td>
          <td>
            <div style="font-size:0.82rem">${o.type}</div>
            <div class="order-type">${o.desc}</div>
          </td>
          <td style="color:var(--silver);font-size:0.78rem">${o.date}</td>
          <td style="color:var(--silver);font-size:0.78rem">${o.eta}</td>
          <td><span class="badge ${s.cls}">${s.label}</span></td>
          <td>
            ${o.status === 'completado'
              ? `<a href="#" class="order-download" onclick="CA.downloadAlbaran('${o.ref}');return false;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg>
                  Albarán
                </a>`
              : `<span style="font-size:0.72rem;color:rgba(192,192,192,0.3)">—</span>`
            }
          </td>
        </tr>`;
    }).join('');
  }

  function renderNotifs(notifs) {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!notifs.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;font-size:0.75rem;color:var(--silver)">Sin notificaciones.</div>`;
      return;
    }
    list.innerHTML = notifs.map(n => `
      <div class="notif-item" data-id="${n.id}">
        <div class="notif-dot${n.read ? ' read' : ''}" onclick="CA.markRead('${n.id}',this)" title="Marcar como leída" style="cursor:pointer"></div>
        <div>
          <div class="notif-text">${n.text}</div>
          <div class="notif-time">${fmtDate(n.createdAt)} · ${n.time}</div>
        </div>
      </div>`).join('');
  }

  /* ── Modal nuevo trabajo ────────────────────────────────── */
  function initModal() {
    const overlay  = document.getElementById('modalOverlay');
    const cancelBtn = document.getElementById('modalCancel');
    const form     = document.getElementById('newOrderForm');
    if (!overlay) return;

    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); overlay.classList.add('open'); });
    });
    cancelBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

    /* Drag & drop y previsualización de archivos */
    const fileInput   = document.getElementById('fileUploadInput');
    const fileDrop    = document.getElementById('fileDrop');
    const previewList = document.getElementById('filePreviewList');
    const dropText    = document.getElementById('fileDropText');

    if (fileInput) {
      fileDrop.addEventListener('click', () => fileInput.click());
      fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('drag-over'); });
      fileDrop.addEventListener('dragleave', ()  => fileDrop.classList.remove('drag-over'));
      fileDrop.addEventListener('drop', e => {
        e.preventDefault();
        fileDrop.classList.remove('drag-over');
        fileInput.files = e.dataTransfer.files;
        updatePreview();
      });
      fileInput.addEventListener('change', updatePreview);
    }

    function updatePreview() {
      const files = fileInput.files;
      dropText.textContent = files.length
        ? `${files.length} archivo(s) seleccionado(s)`
        : 'Haz clic o arrastra archivos aquí';
      previewList.innerHTML = Array.from(files).map(f =>
        `<div class="file-preview-item">
           <span class="file-preview-name">${f.name}</span>
           <span class="file-preview-size">${fmtSize(f.size)}</span>
         </div>`
      ).join('');
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn      = form.querySelector('.modal-submit');
      const progress = document.getElementById('uploadProgress');
      const progText = document.getElementById('uploadProgressText');
      btn.textContent = 'Enviando…';

      /* 1. Crear la solicitud de trabajo */
      const r = await api('POST', '/api/orders/request', {
        tipo:        form.tipo.value,
        descripcion: form.descripcion.value,
        fecha:       form.fecha.value,
        notas:       form.notas.value,
      });

      if (!r.ok) {
        showToast('Error al enviar. Inténtelo de nuevo.');
        btn.textContent = 'Enviar solicitud';
        return;
      }

      /* 2. Subir archivos adjuntos si los hay */
      const files    = fileInput ? Array.from(fileInput.files) : [];
      const fill     = document.getElementById('uploadProgressFill');
      const pct      = document.getElementById('uploadProgressPct');
      if (files.length) {
        progress.style.display = 'flex';
        for (let i = 0; i < files.length; i++) {
          progText.textContent = `Leyendo ${i + 1}/${files.length}: ${files[i].name}`;
          setProgress(fill, pct, (i / files.length) * 50);          // 0-50%: lectura
          const data = await toBase64WithProgress(files[i], p => {
            setProgress(fill, pct, (i / files.length) * 50 + p * 0.5 / files.length * 100);
          });
          progText.textContent = `Subiendo ${i + 1}/${files.length}: ${files[i].name}`;
          setProgress(fill, pct, 50 + (i / files.length) * 50);     // 50-100%: envío
          const ru = await api('POST', '/api/upload', { name: files[i].name, type: files[i].type, data });
          if (!ru.ok) showToast('No se pudo subir: ' + files[i].name);
          setProgress(fill, pct, 50 + ((i + 1) / files.length) * 50);
        }
        setProgress(fill, pct, 100);
        await new Promise(res => setTimeout(res, 400));
        progress.style.display = 'none';
        setProgress(fill, pct, 0);
      }

      overlay.classList.remove('open');
      form.reset();
      if (fileInput) { fileInput.value = ''; updatePreview(); }
      btn.textContent = 'Enviar solicitud';
      showToast(files.length
        ? `Solicitud enviada con ${files.length} archivo(s) adjunto(s).`
        : 'Solicitud enviada. Nos ponemos en contacto pronto.');
      api('GET', '/api/orders').then(res => { if (res.ok) { renderOrders(res.data); renderStats(res.data); } });
    });
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function toBase64WithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      r.onload     = () => resolve(r.result.split(',')[1]);
      r.onerror    = reject;
      r.readAsDataURL(file);
    });
  }

  function setProgress(fill, pct, value) {
    const v = Math.round(Math.min(100, Math.max(0, value)));
    if (fill) fill.style.width = v + '%';
    if (pct)  pct.textContent  = v + '%';
  }

  function fmtSize(bytes) {
    if (!bytes) return '';
    const n = parseInt(bytes);
    if (n < 1024)    return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function initLogout() {
    const btn = document.getElementById('logoutBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        await api('POST', '/api/logout');
        clearToken();
        window.location.href = 'customer-login.html';
      });
    }
  }

  /* ── Públicos ────────────────────────────────────────────── */
  async function markRead(id, dotEl) {
    const r = await api('PATCH', `/api/notifications/${id}/read`);
    if (r.ok && dotEl) dotEl.classList.add('read');
  }

  function downloadAlbaran(ref) {
    showToast(`Descargando albarán ${ref}…`);
  }

  /* ── Utils ───────────────────────────────────────────────── */
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '—';
  }

  function initials(name) {
    return (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  function showToast(msg) {
    let t = document.getElementById('dashToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'dashToast';
      t.style.cssText = `position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(20px);
        background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);color:var(--white);
        padding:14px 28px;border-radius:2px;font-family:'Raleway',sans-serif;font-size:0.8rem;
        font-weight:300;letter-spacing:0.05em;z-index:500;opacity:0;
        transition:opacity 0.4s,transform 0.4s;pointer-events:none;white-space:nowrap;`;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(20px)';
      }, 3200);
    });
  }

  function cursorGlow() {
    const g = document.getElementById('cursorGlow');
    if (g && window.innerWidth > 768) {
      document.addEventListener('mousemove', e => {
        g.style.left = e.clientX + 'px';
        g.style.top  = e.clientY + 'px';
      });
    }
  }

  return { initLogin, initDashboard, downloadAlbaran, markRead };
})();
