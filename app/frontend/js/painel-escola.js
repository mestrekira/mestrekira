// painel-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

// ⚠️ ajuste se seu controller usar outro prefixo
const SCHOOL_API_BASE = '/school-dashboard';

// ------------------- Toast helpers -------------------
function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3200 : 2400),
    });
  } else {
    if (type === 'error') alert(`${title}\n\n${message}`);
    else console.log(title, message);
  }
}

function setStatus(msg) {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = msg || '';
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

function safeJsonParse(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function normRole(role) {
  return String(role || '').trim().toUpperCase();
}

function fmtDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

// ------------------- Sessão (escola) -------------------
const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId', // opcional: vamos preencher se não existir
  professorId: 'professorId',
  studentId: 'studentId',
};

function clearAuth() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.schoolId);
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);
}

function requireSchoolSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  // aceitamos SCHOOL/ESCOLA por compat
  const isSchool = role === 'SCHOOL' || role === 'ESCOLA';

  if (!token || !isSchool) {
    clearAuth();
    window.location.replace('login-escola.html');
    throw new Error('Sessão de escola ausente/inválida');
  }

  // padroniza schoolId
  const uid = String(user?.id || '').trim();
  if (uid && !localStorage.getItem(LS.schoolId)) {
    localStorage.setItem(LS.schoolId, uid);
  }

  // evita conflito de papéis
  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);

  return { token, user, schoolId: uid };
}

async function readJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

async function authFetch(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    clearAuth();
    setTimeout(() => window.location.replace('login-escola.html'), 700);
    throw new Error(`AUTH_${res.status}`);
  }

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const msg = data?.message || data?.error || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function unwrapList(data, keys = []) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

// ------------------- Elementos -------------------
const schoolNameEl = document.getElementById('schoolName');

const yearNameEl = document.getElementById('yearName');
const createYearBtn = document.getElementById('createYearBtn');
const yearSelectEl = document.getElementById('yearSelect');
const yearsTbody = document.getElementById('yearsTbody');

const refreshBtn = document.getElementById('refreshBtn');

const roomNameEl = document.getElementById('roomName');
const teacherNameEl = document.getElementById('teacherName');
const teacherEmailEl = document.getElementById('teacherEmail');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomsTbody = document.getElementById('roomsTbody');

// ------------------- API (anos) -------------------
async function apiCreateYear(session, name) {
  return authFetch(`${SCHOOL_API_BASE}/years`, {
    token: session.token,
    method: 'POST',
    body: { name },
  });
}

async function apiListYears(session) {
  return authFetch(`${SCHOOL_API_BASE}/years`, { token: session.token });
}

async function apiUpdateYear(session, yearId, patch) {
  return authFetch(`${SCHOOL_API_BASE}/years/${encodeURIComponent(String(yearId))}`, {
    token: session.token,
    method: 'PATCH',
    body: patch,
  });
}

async function apiDeleteYear(session, yearId) {
  return authFetch(`${SCHOOL_API_BASE}/years/${encodeURIComponent(String(yearId))}`, {
    token: session.token,
    method: 'DELETE',
  });
}

// ------------------- API (salas) -------------------
async function apiCreateRoom(session, payload) {
  // payload: { name, teacherEmail, yearId? }
  return authFetch(`${SCHOOL_API_BASE}/rooms`, {
    token: session.token,
    method: 'POST',
    body: payload,
  });
}

async function apiListRooms(session, yearId) {
  const q = yearId ? `?yearId=${encodeURIComponent(String(yearId))}` : '';
  return authFetch(`${SCHOOL_API_BASE}/rooms${q}`, { token: session.token });
}

async function apiUpdateRoom(session, roomId, patch) {
  return authFetch(`${SCHOOL_API_BASE}/rooms/${encodeURIComponent(String(roomId))}`, {
    token: session.token,
    method: 'PATCH',
    body: patch,
  });
}

async function apiDeleteRoom(session, roomId) {
  return authFetch(`${SCHOOL_API_BASE}/rooms/${encodeURIComponent(String(roomId))}`, {
    token: session.token,
    method: 'DELETE',
  });
}

// ------------------- Render: anos -------------------
let cachedYears = [];

function renderYearsSelect() {
  if (!yearSelectEl) return;

  const prev = String(yearSelectEl.value || '');

  yearSelectEl.innerHTML = `<option value="">Todos</option>`;

  cachedYears.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = String(y.id);
    opt.textContent = y.name || 'Ano letivo';
    yearSelectEl.appendChild(opt);
  });

  // tenta manter seleção
  if (prev) yearSelectEl.value = prev;
}

function renderYearsTable(session) {
  if (!yearsTbody) return;
  yearsTbody.innerHTML = '';

  if (!cachedYears.length) {
    yearsTbody.innerHTML = `<tr><td colspan="4" class="mk-muted">Nenhum ano letivo cadastrado.</td></tr>`;
    return;
  }

  cachedYears.forEach((y) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = y.name || '—';

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    const on = !!y.isActive;
    badge.className = `mk-badge ${on ? 'on' : 'off'}`;
    badge.textContent = on ? 'Ativo' : 'Inativo';
    tdStatus.appendChild(badge);

    const tdCreated = document.createElement('td');
    tdCreated.textContent = fmtDateBR(y.createdAt);

    const tdActions = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'mk-actions';

    const btnRename = document.createElement('button');
    btnRename.type = 'button';
    btnRename.textContent = 'Renomear';
    btnRename.onclick = async () => {
      const name = prompt('Novo nome do ano letivo:', y.name || '');
      if (name == null) return;
      const n = String(name).trim();
      if (!n) return notify('warn', 'Nome inválido', 'Informe um nome válido.');
      try {
        await apiUpdateYear(session, y.id, { name: n });
        notify('success', 'Atualizado', 'Ano letivo renomeado.');
        await refreshAll(session, { keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.textContent = on ? 'Desativar' : 'Ativar';
    btnToggle.onclick = async () => {
      try {
        await apiUpdateYear(session, y.id, { isActive: !on });
        notify('success', 'Atualizado', `Ano letivo ${!on ? 'ativado' : 'desativado'}.`);
        await refreshAll(session, { keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'danger';
    btnDelete.textContent = 'Excluir';
    btnDelete.onclick = async () => {
      const ok = confirm(
        `Excluir o ano letivo "${y.name}"?\n\nAs salas desse ano serão mantidas, mas ficarão sem ano letivo.`,
      );
      if (!ok) return;
      try {
        await apiDeleteYear(session, y.id);
        notify('success', 'Excluído', 'Ano letivo removido.');
        await refreshAll(session, { keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    wrap.appendChild(btnRename);
    wrap.appendChild(btnToggle);
    wrap.appendChild(btnDelete);

    tdActions.appendChild(wrap);

    tr.appendChild(tdName);
    tr.appendChild(tdStatus);
    tr.appendChild(tdCreated);
    tr.appendChild(tdActions);

    yearsTbody.appendChild(tr);
  });
}

// ------------------- Render: salas -------------------
let cachedRooms = [];

function renderRoomsTable(session) {
  if (!roomsTbody) return;
  roomsTbody.innerHTML = '';

  if (!cachedRooms.length) {
    roomsTbody.innerHTML = `<tr><td colspan="4" class="mk-muted">Nenhuma sala cadastrada ainda.</td></tr>`;
    return;
  }

  cachedRooms.forEach((r) => {
    const tr = document.createElement('tr');

    const tdRoom = document.createElement('td');
    tdRoom.innerHTML = `<strong>${r.name || 'Sala'}</strong><br><small class="mk-muted">Código: ${r.code || '—'}</small>`;

    const tdTeacher = document.createElement('td');
    tdTeacher.innerHTML = `<strong>${r.teacherNameSnapshot || 'Professor'}</strong><br><small class="mk-muted">${r.teacherEmail || ''}</small>`;

    const tdCreated = document.createElement('td');
    tdCreated.textContent = fmtDateBR(r.createdAt);

    const tdActions = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'mk-actions';

    const btnView = document.createElement('button');
    btnView.type = 'button';
    btnView.textContent = 'Visualizar';
    btnView.onclick = () => {
      // Você pode criar desempenho-escola.html ou reutilizar desempenho-professor.html com ajuste de sessão
      window.location.href = `desempenho-escola.html?roomId=${encodeURIComponent(String(r.id))}`;
    };

    const btnRename = document.createElement('button');
    btnRename.type = 'button';
    btnRename.textContent = 'Renomear';
    btnRename.onclick = async () => {
      const name = prompt('Novo nome da sala:', r.name || '');
      if (name == null) return;
      const n = String(name).trim();
      if (!n) return notify('warn', 'Nome inválido', 'Informe um nome válido.');

      try {
        await apiUpdateRoom(session, r.id, { name: n });
        notify('success', 'Atualizado', 'Sala renomeada.');
        await refreshRooms(session, { keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'danger';
    btnDelete.textContent = 'Excluir';
    btnDelete.onclick = async () => {
      const ok = confirm(
        `Excluir a sala "${r.name}"?\n\nAtenção: isso pode falhar se o backend não permitir deletar com tarefas/matrículas.`,
      );
      if (!ok) return;
      try {
        await apiDeleteRoom(session, r.id);
        notify('success', 'Excluída', 'Sala removida.');
        await refreshRooms(session, { keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    wrap.appendChild(btnView);
    wrap.appendChild(btnRename);
    wrap.appendChild(btnDelete);

    tdActions.appendChild(wrap);

    tr.appendChild(tdRoom);
    tr.appendChild(tdTeacher);
    tr.appendChild(tdCreated);
    tr.appendChild(tdActions);

    roomsTbody.appendChild(tr);
  });
}

// ------------------- Loaders -------------------
async function refreshYears(session, { keepStatus } = {}) {
  if (!keepStatus) setStatus('Carregando anos letivos...');
  const res = await apiListYears(session);

  // suporte a {ok:true, years:[...]} ou array direto
  const years = unwrapList(res, ['years']);
  cachedYears = (Array.isArray(years) ? years : []).map((y) => ({
    id: y.id,
    name: y.name,
    isActive: !!y.isActive,
    createdAt: y.createdAt || y.created_at || null,
  }));

  renderYearsSelect();
  renderYearsTable(session);
  if (!keepStatus) setStatus('');
}

async function refreshRooms(session, { keepStatus } = {}) {
  if (!keepStatus) setStatus('Carregando salas...');
  const yearId = yearSelectEl ? String(yearSelectEl.value || '') : '';
  const res = await apiListRooms(session, yearId || null);

  const rooms = unwrapList(res, ['rooms']);
  cachedRooms = (Array.isArray(rooms) ? rooms : []).map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    teacherId: r.teacherId || r.teacher_id || null,
    teacherNameSnapshot: r.teacherNameSnapshot || r.teacher_name_snapshot || '',
    teacherEmail: r.teacherEmail || '', // se backend não manda, fica vazio (ok)
    createdAt: r.createdAt || r.created_at || null,
  }));

  renderRoomsTable(session);
  if (!keepStatus) setStatus('');
}

async function refreshAll(session, { keepStatus } = {}) {
  await refreshYears(session, { keepStatus: true });
  await refreshRooms(session, { keepStatus: true });
  if (!keepStatus) setStatus('');
}

// ------------------- Actions -------------------
async function onCreateYear(session) {
  const name = String(yearNameEl?.value || '').trim();
  if (!name) return notify('warn', 'Campos obrigatórios', 'Informe o nome do ano letivo.');

  try {
    setStatus('Cadastrando ano letivo...');
    await apiCreateYear(session, name);
    if (yearNameEl) yearNameEl.value = '';
    notify('success', 'Criado', 'Ano letivo cadastrado.');
    await refreshAll(session, { keepStatus: true });
    setStatus('');
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
    setStatus('');
  }
}

async function onCreateRoom(session) {
  const name = String(roomNameEl?.value || '').trim();
  const teacherName = String(teacherNameEl?.value || '').trim(); // UX
  const teacherEmail = String(teacherEmailEl?.value || '').trim().toLowerCase();
  const yearId = yearSelectEl ? String(yearSelectEl.value || '') : '';

  if (!name || !teacherEmail) {
    return notify('warn', 'Campos obrigatórios', 'Informe nome da sala e e-mail do professor.');
  }
  if (!teacherEmail.includes('@')) {
    return notify('warn', 'E-mail inválido', 'Informe um e-mail válido do professor.');
  }

  try {
    setStatus('Cadastrando sala...');
    await apiCreateRoom(session, {
      name,
      teacherEmail,
      yearId: yearId || null,
      teacherName, // se backend ignorar, ok
    });

    if (roomNameEl) roomNameEl.value = '';
    if (teacherNameEl) teacherNameEl.value = '';
    if (teacherEmailEl) teacherEmailEl.value = '';

    notify('success', 'Criada', 'Sala cadastrada com sucesso.');
    await refreshRooms(session, { keepStatus: true });
    setStatus('');
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
    setStatus('');
  }
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', async () => {
  const session = requireSchoolSession();

  // nome da escola pelo user salvo
  setText(schoolNameEl, session.user?.name || 'Escola');

  if (createYearBtn) createYearBtn.addEventListener('click', () => onCreateYear(session));
  if (createRoomBtn) createRoomBtn.addEventListener('click', () => onCreateRoom(session));

  if (refreshBtn) refreshBtn.addEventListener('click', () => refreshAll(session));

  if (yearSelectEl) {
    yearSelectEl.addEventListener('change', () => refreshRooms(session));
  }

  try {
    await refreshAll(session);
  } catch (e) {
    console.error(e);
    setStatus('Erro ao carregar painel.');
    notify('error', 'Erro', String(e?.message || e));
  }
});
