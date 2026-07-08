/* ══════════════════════════════════════════════════════════════
   STRATTON DENTAL STUDIOS — Servidor Node.js
   Sirve archivos estáticos + API REST para el Área de Clientes
   Sin dependencias externas — solo módulos nativos de Node.js
   ══════════════════════════════════════════════════════════════ */

const http             = require('http');
const fs               = require('fs');
const path             = require('path');
const crypto           = require('crypto');
const { Readable }     = require('stream');

const PORT       = 3000;
const DB_PATH    = path.join(__dirname, 'database.json');
const ADMIN_PW   = 'stratton_admin_2024';
const ADMIN_USER = 'stratton.admin';

/* ── Google Drive ────────────────────────────────────────────── */
let drive               = null;
let DRIVE_PARENT_FOLDER = '';

/* ── Sesiones en memoria ─────────────────────────────────────── */
const userSessions  = new Map(); // token → { userId, expiresAt }
const adminSessions = new Set(); // tokens de administrador

/* ── MIME types ──────────────────────────────────────────────── */
const MIME = {
  '.html':  'text/html',
  '.css':   'text/css',
  '.js':    'application/javascript',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
};

/* ── DB helpers ──────────────────────────────────────────────── */
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

/* ── HTTP helpers ────────────────────────────────────────────── */
function getBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { resolve({}); }
    });
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res) { json(res, 404, { error: 'Ruta no encontrada' }); }

/* ── Auth helpers ────────────────────────────────────────────── */
function token() { return crypto.randomBytes(32).toString('hex'); }

function authUser(req) {
  const raw = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const s   = userSessions.get(raw);
  if (!s || s.expiresAt < Date.now()) { userSessions.delete(raw); return null; }
  return s;
}

function authAdmin(req) {
  const raw = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return adminSessions.has(raw) ? raw : null;
}

function safeUser(u) { const { password, ...s } = u; return s; }

function nextRef(orders) {
  const year = new Date().getFullYear();
  const max  = orders
    .map(o => parseInt((o.ref || '').replace(`#${year}-`, '') || 0, 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return `#${year}-${String(max + 1).padStart(3, '0')}`;
}

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

/* ══ GOOGLE DRIVE HELPERS ════════════════════════════════════ */

function initDrive() {
  const credsPath   = path.join(__dirname, 'credentials.json');
  const configPath  = path.join(__dirname, 'drive-config.json');
  if (!fs.existsSync(credsPath) || !fs.existsSync(configPath)) {
    console.log('  Drive: credentials.json o drive-config.json no encontrados. Subida deshabilitada.');
    return;
  }
  try {
    const { google }    = require('googleapis');
    const creds         = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const config        = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    DRIVE_PARENT_FOLDER = config.folderId;
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    drive = google.drive({ version: 'v3', auth });
    console.log('  ✓ Google Drive conectado. Carpeta raíz:', DRIVE_PARENT_FOLDER);
  } catch (err) {
    console.warn('  ✗ Google Drive no disponible:', err.message);
  }
}

async function getOrCreateClientFolder(user) {
  const db  = readDB();
  const usr = db.users.find(x => x.id === user.id);
  if (usr && usr.driveFolderId) return usr.driveFolderId;

  const folderName = `${user.id} · ${user.name}`;
  const list = await drive.files.list({
    q: `name='${folderName}' and '${DRIVE_PARENT_FOLDER}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
  });

  let folderId;
  if (list.data.files.length > 0) {
    folderId = list.data.files[0].id;
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [DRIVE_PARENT_FOLDER],
      },
      fields: 'id',
    });
    folderId = created.data.id;
  }

  const idx = db.users.findIndex(x => x.id === user.id);
  if (idx !== -1) { db.users[idx].driveFolderId = folderId; writeDB(db); }
  return folderId;
}

async function uploadFileToDrive(folderId, fileName, mimeType, buffer) {
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media:       { mimeType, body: Readable.from(buffer) },
    fields:      'id, name, webViewLink, createdTime, size',
  });
  return res.data;
}

async function listDriveFiles(folderId) {
  const res = await drive.files.list({
    q:       `'${folderId}' in parents and trashed=false`,
    fields:  'files(id, name, mimeType, webViewLink, createdTime, size)',
    orderBy: 'createdTime desc',
    pageSize: 50,
  });
  return res.data.files;
}

/* ══ API HANDLERS ════════════════════════════════════════════ */

async function handleAPI(method, parts, req, res) {

  /* ── POST /api/login ─────────────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'login'])) {
    const { username, password } = await getBody(req);

    /* Acceso admin desde el login de clientes */
    if (
      (username || '').toLowerCase() === ADMIN_USER.toLowerCase() &&
      password === ADMIN_PW
    ) {
      const tk = token();
      adminSessions.add(tk);
      return json(res, 200, { token: tk, isAdmin: true });
    }

    const db   = readDB();
    const user = db.users.find(
      u => u.username && u.username.toLowerCase() === (username || '').toLowerCase() && u.password === password
    );
    if (!user) return json(res, 401, { error: 'Credenciales incorrectas' });
    const tk = token();
    userSessions.set(tk, { userId: user.id, expiresAt: Date.now() + 86400000 });
    return json(res, 200, { token: tk, user: safeUser(user) });
  }

  /* ── POST /api/admin/login ───────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'admin', 'login'])) {
    const { password } = await getBody(req);
    if (password !== ADMIN_PW) return json(res, 401, { error: 'Contraseña incorrecta' });
    const tk = token();
    adminSessions.add(tk);
    return json(res, 200, { token: tk });
  }

  /* ── POST /api/logout ────────────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'logout'])) {
    const raw = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    userSessions.delete(raw);
    adminSessions.delete(raw);
    return json(res, 200, { ok: true });
  }

  /* ── GET /api/me ─────────────────────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'me'])) {
    const s = authUser(req);
    if (!s) return json(res, 401, { error: 'No autenticado' });
    const db   = readDB();
    const user = db.users.find(u => u.id === s.userId);
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' });
    return json(res, 200, safeUser(user));
  }

  /* ── GET /api/orders ─────────────────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'orders'])) {
    const s = authUser(req);
    if (!s) return json(res, 401, { error: 'No autenticado' });
    const db  = readDB();
    const out = db.orders
      .filter(o => o.userId === s.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(res, 200, out);
  }

  /* ── POST /api/orders/request ────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'orders', 'request'])) {
    const s = authUser(req);
    if (!s) return json(res, 401, { error: 'No autenticado' });
    const body = await getBody(req);
    const db   = readDB();
    const order = {
      id:        crypto.randomUUID(),
      userId:    s.userId,
      ref:       nextRef(db.orders),
      type:      body.tipo || 'General',
      desc:      body.descripcion || '',
      date:      new Date().toLocaleDateString('es-ES'),
      eta:       body.fecha || '—',
      status:    'pendiente',
      notes:     body.notas || '',
      createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    writeDB(db);
    return json(res, 201, order);
  }

  /* ── GET /api/notifications ──────────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'notifications'])) {
    const s = authUser(req);
    if (!s) return json(res, 401, { error: 'No autenticado' });
    const db  = readDB();
    const out = db.notifications
      .filter(n => n.userId === s.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(res, 200, out);
  }

  /* ── PATCH /api/notifications/:id/read ──────────────────── */
  if (method === 'PATCH' && parts[0] === 'api' && parts[1] === 'notifications' && parts[3] === 'read') {
    const s = authUser(req);
    if (!s) return json(res, 401, { error: 'No autenticado' });
    const db    = readDB();
    const notif = db.notifications.find(n => n.id === parts[2] && n.userId === s.userId);
    if (!notif) return json(res, 404, { error: 'Notificación no encontrada' });
    notif.read = true;
    writeDB(db);
    return json(res, 200, notif);
  }

  /* ════════════════════════════════════════════════════════
     ADMIN ROUTES — requieren token de administrador
  ════════════════════════════════════════════════════════ */

  /* ── GET /api/admin/users ────────────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'admin', 'users'])) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const db = readDB();
    return json(res, 200, db.users.map(safeUser));
  }

  /* ── POST /api/admin/users ───────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'admin', 'users'])) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const body = await getBody(req);
    const db   = readDB();
    if (!body.username || !body.name) return json(res, 400, { error: 'Nombre y usuario son obligatorios' });
    if (db.users.find(u => u.username && u.username.toLowerCase() === body.username.toLowerCase()))
      return json(res, 409, { error: 'El nombre de usuario ya está en uso' });
    const user = {
      id:       'USR' + String(db.users.length + 1).padStart(3, '0'),
      username: body.username,
      email:    body.email    || '',
      password: body.password || 'stratton2024',
      name:     body.name,
      initials: body.initials || initials(body.name),
      clinic:   body.clinic   || '',
      phone:    body.phone    || '',
      since:    new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    };
    db.users.push(user);
    writeDB(db);
    return json(res, 201, safeUser(user));
  }

  /* ── PUT /api/admin/users/:id ────────────────────────────── */
  if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const body = await getBody(req);
    const db   = readDB();
    const idx  = db.users.findIndex(u => u.id === parts[3]);
    if (idx === -1) return json(res, 404, { error: 'Usuario no encontrado' });
    db.users[idx] = { ...db.users[idx], ...body, id: db.users[idx].id };
    if (body.name && !body.initials) db.users[idx].initials = initials(body.name);
    writeDB(db);
    return json(res, 200, safeUser(db.users[idx]));
  }

  /* ── DELETE /api/admin/users/:id ─────────────────────────── */
  if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'users' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const db  = readDB();
    const idx = db.users.findIndex(u => u.id === parts[3]);
    if (idx === -1) return json(res, 404, { error: 'Usuario no encontrado' });
    db.users.splice(idx, 1);
    writeDB(db);
    return json(res, 200, { ok: true });
  }

  /* ── GET /api/admin/orders ───────────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'admin', 'orders'])) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const db = readDB();
    const orders = db.orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(o => {
        const user = db.users.find(u => u.id === o.userId);
        return { ...o, userName: user ? user.name : '—', userClinic: user ? user.clinic : '—' };
      });
    return json(res, 200, orders);
  }

  /* ── POST /api/admin/orders ──────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'admin', 'orders'])) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const body = await getBody(req);
    const db   = readDB();
    if (!body.userId) return json(res, 400, { error: 'userId es obligatorio' });
    const order = {
      id:        crypto.randomUUID(),
      userId:    body.userId,
      ref:       nextRef(db.orders),
      type:      body.type   || 'General',
      desc:      body.desc   || '',
      date:      body.date   || new Date().toLocaleDateString('es-ES'),
      eta:       body.eta    || '—',
      status:    body.status || 'pendiente',
      notes:     body.notes  || '',
      createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    writeDB(db);
    return json(res, 201, order);
  }

  /* ── PUT /api/admin/orders/:id ───────────────────────────── */
  if (method === 'PUT' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'orders' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const body = await getBody(req);
    const db   = readDB();
    const idx  = db.orders.findIndex(o => o.id === parts[3]);
    if (idx === -1) return json(res, 404, { error: 'Trabajo no encontrado' });
    db.orders[idx] = { ...db.orders[idx], ...body, id: db.orders[idx].id, userId: db.orders[idx].userId };
    writeDB(db);
    return json(res, 200, db.orders[idx]);
  }

  /* ── DELETE /api/admin/orders/:id ────────────────────────── */
  if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'orders' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const db  = readDB();
    const idx = db.orders.findIndex(o => o.id === parts[3]);
    if (idx === -1) return json(res, 404, { error: 'Trabajo no encontrado' });
    db.orders.splice(idx, 1);
    writeDB(db);
    return json(res, 200, { ok: true });
  }

  /* ── GET /api/admin/notifications ────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'admin', 'notifications'])) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const db = readDB();
    const out = db.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(n => {
        const user = db.users.find(u => u.id === n.userId);
        return { ...n, userName: user ? user.name : '—' };
      });
    return json(res, 200, out);
  }

  /* ── POST /api/admin/notifications ──────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'admin', 'notifications'])) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const body = await getBody(req);
    if (!body.userId || !body.text) return json(res, 400, { error: 'userId y text son obligatorios' });
    const db = readDB();
    const notif = {
      id:        crypto.randomUUID(),
      userId:    body.userId,
      text:      body.text,
      time:      new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      read:      false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.push(notif);
    writeDB(db);
    return json(res, 201, notif);
  }

  /* ── DELETE /api/admin/notifications/:id ─────────────────── */
  if (method === 'DELETE' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'notifications' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    const db  = readDB();
    const idx = db.notifications.findIndex(n => n.id === parts[3]);
    if (idx === -1) return json(res, 404, { error: 'Notificación no encontrada' });
    db.notifications.splice(idx, 1);
    writeDB(db);
    return json(res, 200, { ok: true });
  }

  /* ── POST /api/upload ───────────────────────────────────────── */
  if (method === 'POST' && match(parts, ['api', 'upload'])) {
    const s = authUser(req);
    if (!s)     return json(res, 401, { error: 'No autenticado' });
    if (!drive) return json(res, 503, { error: 'Google Drive no configurado aún.' });
    const body = await getBody(req);
    if (!body.name || !body.data) return json(res, 400, { error: 'Archivo inválido' });
    const db   = readDB();
    const user = db.users.find(u => u.id === s.userId);
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' });
    try {
      const folderId = await getOrCreateClientFolder(user);
      const buffer   = Buffer.from(body.data, 'base64');
      const file     = await uploadFileToDrive(folderId, body.name, body.type || 'application/octet-stream', buffer);
      return json(res, 201, file);
    } catch (err) {
      console.error('[Drive upload]', err.message);
      return json(res, 500, { error: 'Error al subir el archivo.' });
    }
  }

  /* ── GET /api/files ─────────────────────────────────────────── */
  if (method === 'GET' && match(parts, ['api', 'files'])) {
    const s = authUser(req);
    if (!s)     return json(res, 401, { error: 'No autenticado' });
    if (!drive) return json(res, 200, []);
    const db   = readDB();
    const user = db.users.find(u => u.id === s.userId);
    if (!user || !user.driveFolderId) return json(res, 200, []);
    try {
      const files = await listDriveFiles(user.driveFolderId);
      return json(res, 200, files);
    } catch (err) {
      return json(res, 500, { error: 'Error al listar archivos.' });
    }
  }

  /* ── POST /api/admin/upload/:userId ─────────────────────────── */
  if (method === 'POST' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'upload' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    if (!drive)          return json(res, 503, { error: 'Google Drive no configurado aún.' });
    const body = await getBody(req);
    if (!body.name || !body.data) return json(res, 400, { error: 'Archivo inválido' });
    const db   = readDB();
    const user = db.users.find(u => u.id === parts[3]);
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' });
    try {
      const folderId = await getOrCreateClientFolder(user);
      const buffer   = Buffer.from(body.data, 'base64');
      const file     = await uploadFileToDrive(folderId, body.name, body.type || 'application/octet-stream', buffer);
      return json(res, 201, file);
    } catch (err) {
      console.error('[Drive admin upload]', err.message);
      return json(res, 500, { error: 'Error al subir el archivo.' });
    }
  }

  /* ── GET /api/admin/files/:userId ───────────────────────────── */
  if (method === 'GET' && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'files' && parts[3]) {
    if (!authAdmin(req)) return json(res, 401, { error: 'No autenticado' });
    if (!drive)          return json(res, 200, []);
    const db   = readDB();
    const user = db.users.find(u => u.id === parts[3]);
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' });
    try {
      const folderId = user.driveFolderId || await getOrCreateClientFolder(user);
      const files    = await listDriveFiles(folderId);
      return json(res, 200, files);
    } catch (err) {
      return json(res, 500, { error: 'Error al listar archivos.' });
    }
  }

  return notFound(res);
}

/* ── Helper: comparar ruta con array fijo ────────────────────── */
function match(parts, expected) {
  return parts.length === expected.length && expected.every((s, i) => parts[i] === s);
}

/* ══ SERVIDOR HTTP ═══════════════════════════════════════════ */

http.createServer(async (req, res) => {
  const method   = req.method.toUpperCase();
  const pathname = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  const parts    = pathname.split('/').filter(Boolean);

  /* Preflight CORS (por si se usa desde otro origen en dev) */
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  /* Rutas de API */
  if (parts[0] === 'api') {
    try {
      await handleAPI(method, parts, req, res);
    } catch (err) {
      console.error('[API Error]', err);
      json(res, 500, { error: 'Error interno del servidor' });
    }
    return;
  }

  /* Archivos estáticos */
  if (method !== 'GET') {
    res.writeHead(405); return res.end('Method Not Allowed');
  }

  const filePath = path.join(
    __dirname,
    pathname === '/' ? 'index.html' : pathname
  );

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 — Archivo no encontrado');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type':   MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(data);
  });

}).listen(PORT, () => {
  initDrive();
  console.log(`\n  ┌─────────────────────────────────────────────┐`);
  console.log(`  │  Stratton Dental Studios — Servidor activo  │`);
  console.log(`  │  http://localhost:${PORT}                       │`);
  console.log(`  │  Panel Admin: http://localhost:${PORT}/admin.html │`);
  console.log(`  └─────────────────────────────────────────────┘\n`);
});
