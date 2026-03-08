import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const SCHOOL_API_BASE = '/school-dashboard';

// ------------------- Toast helpers -------------------
function notify(type, title, message, duration) {
  if (typeof toast === 'function') {
    toast({
      type,
      title,
      message,
      duration:
        duration ??
        (type === 'error' ? 3600 : type === 'warn' ? 3200 : 2400),
    });
  } else {
    if (type === 'error') {
      alert(`${title}\n\n${message}`);
    } else {
      console.log(title, message);
    }
  }
}

function setStatus(msg) {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = msg || '';
}

function setText(el, value) {
  if (!el) return;
  el.textContent =
    value === null || value === undefined || value === '' ? '—' : String(value);
}

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ------------------- Sessão (escola) -------------------
const LS = {
  token: 'token',
  user: 'user',
  schoolId: 'schoolId',
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

  const isSchool = role === 'SCHOOL' || role === 'ESCOLA';

  if (!token || !isSchool) {
    clearAuth();
    window.location.replace('login-escola.html');
    throw new Error('Sessão de escola ausente/inválida');
  }

  const uid = String(user?.id || '').trim();
  if (uid && !localStorage.getItem(LS.schoolId)) {
    localStorage.setItem(LS.schoolId, uid);
  }

  localStorage.removeItem(LS.professorId);
  localStorage.removeItem(LS.studentId);

  return { token, user, schoolId: uid };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function authFetch(path, { token, method = 'GET', body } = {}) {
  const headers = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const url = `${API_URL}${path}`;
  setStatus(
    `DEBUG → ${method} ${path} | token: ${token ? token.slice(0, 20) + '...' : '(ausente)'}`
  );

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await readJsonSafe(res);

  if (res.status === 401 || res.status === 403) {
    clearAuth();
    notify('warn', 'Sessão expirada', 'Faça login novamente para continuar.', 3200);
    setTimeout(() => window.location.replace('login-escola.html'), 700);
    throw new Error(`AUTH_${res.status}: ${JSON.stringify(data)}`);
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`HTTP 404 em ${method} ${path}`);
    }

    const msg =
      Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || data?.error || `Erro HTTP ${res.status}`;

    throw new Error(String(msg));
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
const yearsTbody = document.getElementById('yearsTbody');

const refreshBtn = document.getElementById('refreshBtn');

const roomNameEl = document.getElementById('roomName');
const teacherNameEl = document.getElementById('teacherName');
const teacherEmailEl = document.getElementById('teacherEmail');
const roomYearSelectEl = document.getElementById('roomYearSelect');
const createRoomBtn = document.getElementById('createRoomBtn');

const roomsFilterYearSelectEl = document.getElementById('roomsFilterYearSelect');
const roomsTbody = document.getElementById('roomsTbody');

const roomsSectionEl = document.getElementById('roomsSection');
const createRoomAreaEl = document.getElementById('createRoomArea');
const roomsBlockedNoteEl = document.getElementById('roomsBlockedNote');

// ------------------- API (anos) -------------------
async function apiCreateYear(session, name) {
  return authFetch(`${SCHOOL_API_BASE}/years`, {
    token: session.token,
    method: 'POST',
    body: { name },
  });
}

async function apiListYears(session) {
  return authFetch(`${SCHOOL_API_BASE}/years`, {
    token: session.token,
  });
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
  return authFetch(`${SCHOOL_API_BASE}/rooms`, {
    token: session.token,
    method: 'POST',
    body: payload,
  });
}

async function apiListRooms(session, yearId) {
  const q = yearId ? `?yearId=${encodeURIComponent(String(yearId))}` : '';
  return authFetch(`${SCHOOL_API_BASE}/rooms${q}`, {
    token: session.token,
  });
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

// ------------------- Estado UI -------------------
let cachedYears = [];
let cachedRooms = [];

function sortYearsMostRecentFirst(years) {
  return [...(Array.isArray(years) ? years : [])].sort((a, b) => {
    const nameA = String(a?.name || '').trim();
    const nameB = String(b?.name || '').trim();

    const numA = Number(nameA.replace(/[^\d]/g, '')) || 0;
    const numB = Number(nameB.replace(/[^\d]/g, '')) || 0;

    if (numA !== numB) return numB - numA;

    const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;

    return dateB - dateA;
  });
}

function getDefaultYearId() {
  if (!cachedYears.length) return '';

  const ordered = sortYearsMostRecentFirst(cachedYears);
  const activeOrdered = ordered.filter((y) => !!y.isActive);

  if (activeOrdered.length) {
    return String(activeOrdered[0].id);
  }

  return String(ordered[0].id);
}

function getYearNameById(yearId) {
  const year = cachedYears.find((y) => String(y.id) === String(yearId));
  return year?.name || '—';
}

function updateRoomsAvailability() {
  const hasYears = cachedYears.length > 0;

  if (roomsSectionEl) {
    roomsSectionEl.style.display = '';
  }

  if (roomsBlockedNoteEl) {
    roomsBlockedNoteEl.style.display = hasYears ? 'none' : '';
  }

  if (createRoomAreaEl) {
    createRoomAreaEl.style.display = hasYears ? 'flex' : 'none';
  }

  if (createRoomBtn) createRoomBtn.disabled = !hasYears;
  if (roomYearSelectEl) roomYearSelectEl.disabled = !hasYears;
  if (roomsFilterYearSelectEl) roomsFilterYearSelectEl.disabled = !hasYears;

  if (!hasYears && roomsTbody) {
    roomsTbody.innerHTML =
      '<tr><td colspan="5" class="mk-muted">Cadastre ao menos um ano letivo para liberar o cadastro e a listagem filtrada de salas.</td></tr>';
  }
}

// ------------------- Render: anos -------------------
function renderYearSelectOptions(
  selectEl,
  {
    includeAllOption = false,
    allLabel = 'Todos os anos',
    placeholder = 'Selecione um ano letivo',
    selectedValue = '',
  } = {},
) {
  if (!selectEl) return;

  const years = sortYearsMostRecentFirst(cachedYears);
  const validIds = new Set(years.map((y) => String(y.id)));

  selectEl.innerHTML = '';

  if (includeAllOption) {
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = allLabel;
    selectEl.appendChild(optAll);
  } else {
    const optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.textContent = placeholder;
    selectEl.appendChild(optPlaceholder);
  }

  years.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = String(y.id);
    opt.textContent = y.name || 'Ano letivo';
    selectEl.appendChild(opt);
  });

  const fallbackId = getDefaultYearId();
  const desired =
    selectedValue && validIds.has(String(selectedValue))
      ? String(selectedValue)
      : fallbackId && validIds.has(String(fallbackId))
        ? String(fallbackId)
        : '';

  if (desired) {
    selectEl.value = desired;
  } else if (includeAllOption) {
    selectEl.value = '';
  }
}

function syncYearSelects() {
  const currentCreateValue = String(roomYearSelectEl?.value || '').trim();
  const currentFilterValue = String(roomsFilterYearSelectEl?.value || '').trim();

  renderYearSelectOptions(roomYearSelectEl, {
    includeAllOption: false,
    placeholder: 'Selecione um ano letivo',
    selectedValue: currentCreateValue,
  });

  renderYearSelectOptions(roomsFilterYearSelectEl, {
    includeAllOption: true,
    allLabel: 'Todos os anos',
    selectedValue: currentFilterValue,
  });

  const defaultYearId = getDefaultYearId();

  if (roomYearSelectEl && !String(roomYearSelectEl.value || '').trim() && defaultYearId) {
    roomYearSelectEl.value = defaultYearId;
  }

  if (
    roomsFilterYearSelectEl &&
    !String(roomsFilterYearSelectEl.value || '').trim() &&
    defaultYearId
  ) {
    roomsFilterYearSelectEl.value = defaultYearId;
  }
}

function renderYearsTable(session) {
  if (!yearsTbody) return;

  yearsTbody.innerHTML = '';

  if (!cachedYears.length) {
    yearsTbody.innerHTML =
      '<tr><td colspan="4" class="mk-muted">Nenhum ano letivo cadastrado.</td></tr>';
    return;
  }

  const years = sortYearsMostRecentFirst(cachedYears);

  years.forEach((y) => {
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
      if (!n) {
        notify('warn', 'Nome inválido', 'Informe um nome válido.');
        return;
      }

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
        notify(
          'success',
          'Atualizado',
          `Ano letivo ${!on ? 'ativado' : 'desativado'}.`,
        );
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
function renderRoomsTable(session) {
  if (!roomsTbody) return;

  roomsTbody.innerHTML = '';

  if (!cachedYears.length) {
    roomsTbody.innerHTML =
      '<tr><td colspan="5" class="mk-muted">Cadastre ao menos um ano letivo para liberar o cadastro de salas.</td></tr>';
    return;
  }

  if (!cachedRooms.length) {
    roomsTbody.innerHTML =
      '<tr><td colspan="5" class="mk-muted">Nenhuma sala cadastrada ainda.</td></tr>';
    return;
  }

  cachedRooms.forEach((r) => {
    const tr = document.createElement('tr');

    const tdRoom = document.createElement('td');
    tdRoom.innerHTML =
      `<strong>${escapeHtml(r.name || 'Sala')}</strong><br>` +
      `<small class="mk-muted">Código: ${escapeHtml(r.code || '—')}</small>`;

    const tdTeacher = document.createElement('td');
    tdTeacher.innerHTML =
      `<strong>${escapeHtml(r.teacherNameSnapshot || 'Professor')}</strong>` +
      (r.teacherEmail
        ? `<br><small class="mk-muted">${escapeHtml(r.teacherEmail)}</small>`
        : '');

    const tdYear = document.createElement('td');
    tdYear.textContent = getYearNameById(r.schoolYearId);

    const tdCreated = document.createElement('td');
    tdCreated.textContent = fmtDateBR(r.createdAt);

    const tdActions = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'mk-actions';

    const btnView = document.createElement('button');
    btnView.type = 'button';
    btnView.textContent = 'Visualizar';
    btnView.onclick = () => {
      window.location.href = `desempenho-escola.html?roomId=${encodeURIComponent(
        String(r.id),
      )}`;
    };

    const btnRename = document.createElement('button');
    btnRename.type = 'button';
    btnRename.textContent = 'Renomear';
    btnRename.onclick = async () => {
      const name = prompt('Novo nome da sala:', r.name || '');
      if (name == null) return;

      const n = String(name).trim();
      if (!n) {
        notify('warn', 'Nome inválido', 'Informe um nome válido.');
        return;
      }

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
        `Excluir a sala "${r.name}"?\n\nAtenção: isso pode falhar se o backend não permitir deletar com tarefas ou matrículas.`,
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
    tr.appendChild(tdYear);
    tr.appendChild(tdCreated);
    tr.appendChild(tdActions);

    roomsTbody.appendChild(tr);
  });
}

// ------------------- Loaders -------------------
async function refreshYears(session, { keepStatus } = {}) {
  if (!keepStatus) setStatus('Carregando anos letivos...');

  const res = await apiListYears(session);
  const years = unwrapList(res, ['years']);

  cachedYears = (Array.isArray(years) ? years : [])
    .filter((y) => y && y.id)
    .map((y) => ({
      id: String(y.id),
      name: String(y.name || '').trim(),
      isActive: !!y.isActive,
      createdAt: y.createdAt || y.created_at || null,
    }));

  syncYearSelects();
  renderYearsTable(session);
  updateRoomsAvailability();

  if (!keepStatus) setStatus('');
}

async function refreshRooms(session, { keepStatus } = {}) {
  if (!cachedYears.length) {
    cachedRooms = [];
    renderRoomsTable(session);
    return;
  }

  if (!keepStatus) setStatus('Carregando salas...');

  const yearId = roomsFilterYearSelectEl
    ? String(roomsFilterYearSelectEl.value || '').trim()
    : '';

  const res = await apiListRooms(session, yearId || null);
  const rooms = unwrapList(res, ['rooms']);

  cachedRooms = (Array.isArray(rooms) ? rooms : []).map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    teacherId: r.teacherId || r.teacher_id || null,
    teacherNameSnapshot: r.teacherNameSnapshot || r.teacher_name_snapshot || '',
    teacherEmail: r.teacherEmail || '',
    schoolYearId: r.schoolYearId || r.school_year_id || null,
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

  if (!name) {
    notify('warn', 'Campos obrigatórios', 'Informe o nome do ano letivo.');
    return;
  }

  try {
    setStatus('Cadastrando ano letivo...');
    await apiCreateYear(session, name);

    if (yearNameEl) yearNameEl.value = '';

    notify('success', 'Criado', 'Ano letivo cadastrado.');
    await refreshAll(session, { keepStatus: true });

    const defaultYearId = getDefaultYearId();
    if (roomYearSelectEl && defaultYearId) roomYearSelectEl.value = defaultYearId;
    if (roomsFilterYearSelectEl && defaultYearId) {
      roomsFilterYearSelectEl.value = defaultYearId;
    }

    setStatus('');
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
    setStatus('');
  }
}

async function onCreateRoom(session) {
  const name = String(roomNameEl?.value || '').trim();
  const teacherName = String(teacherNameEl?.value || '').trim();
  const teacherEmail = String(teacherEmailEl?.value || '').trim().toLowerCase();

  let yearId = roomYearSelectEl ? String(roomYearSelectEl.value || '').trim() : '';

  if (!yearId) {
    yearId = getDefaultYearId();
    if (roomYearSelectEl && yearId) {
      roomYearSelectEl.value = yearId;
    }
  }

  if (!cachedYears.length) {
    notify(
      'warn',
      'Ano letivo obrigatório',
      'Cadastre primeiro um ano letivo para liberar o cadastro de salas.',
    );
    return;
  }

  if (!yearId) {
    notify(
      'warn',
      'Ano letivo obrigatório',
      'Selecione o ano letivo da sala antes de cadastrar.',
    );
    return;
  }

  if (!name || !teacherEmail) {
    notify(
      'warn',
      'Campos obrigatórios',
      'Informe o nome da sala e o e-mail do professor.',
    );
    return;
  }

  if (!teacherEmail.includes('@')) {
    notify('warn', 'E-mail inválido', 'Informe um e-mail válido do professor.');
    return;
  }

  try {
    setStatus('Cadastrando sala...');

    await apiCreateRoom(session, {
      name,
      teacherEmail,
      yearId,
      teacherName,
    });

    if (roomNameEl) roomNameEl.value = '';
    if (teacherNameEl) teacherNameEl.value = '';
    if (teacherEmailEl) teacherEmailEl.value = '';

    notify('success', 'Criada', 'Sala cadastrada com sucesso.');

    if (roomsFilterYearSelectEl && yearId) {
      roomsFilterYearSelectEl.value = yearId;
    }

    await refreshRooms(session, { keepStatus: true });
    setStatus('');
  } catch (e) {
    const msg = String(e?.message || e);

    if (msg.includes('Professor não encontrado')) {
      notify(
        'error',
        'Professor não encontrado',
        'O e-mail informado precisa ser de um professor já cadastrado e vinculado a esta escola.',
      );
    } else if (msg.includes('Rota não encontrada')) {
      notify(
        'error',
        'Rota não encontrada',
        'O backend publicado não está reconhecendo a rota de salas. Verifique se o deploy mais recente foi publicado no Render.',
      );
    } else {
      notify('error', 'Erro', msg);
    }

    setStatus('');
  }
}

// ------------------- Init -------------------
document.addEventListener('DOMContentLoaded', async () => {
  const session = requireSchoolSession();

  setText(schoolNameEl, session.user?.name || 'Escola');

  if (createYearBtn) {
    createYearBtn.addEventListener('click', () => onCreateYear(session));
  }

  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => onCreateRoom(session));
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshAll(session));
  }

  if (roomsFilterYearSelectEl) {
    roomsFilterYearSelectEl.addEventListener('change', () => refreshRooms(session));
  }

  try {
    await refreshAll(session);
  } catch (e) {
    console.error(e);

    const msg = String(e?.message || e);

    if (msg.includes('Rota não encontrada')) {
      setStatus('Erro ao carregar painel: rota do backend não encontrada.');
      notify(
        'error',
        'Backend desatualizado',
        'A rota do painel escolar não foi encontrada no servidor. Verifique se o último deploy foi publicado.',
      );
    } else {
      setStatus('Erro ao carregar painel.');
      notify('error', 'Erro', msg);
    }
  }
});
