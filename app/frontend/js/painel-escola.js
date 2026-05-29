import { API_URL } from './config.js';
import {
  notify,
  requireSchoolSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

const SCHOOL_API_BASE = '/school-dashboard';

function setStatus(msg) {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

function setText(el, value) {
  if (!el) return;

  const text =
    value === null || value === undefined || String(value).trim() === ''
      ? '—'
      : String(value).trim();

  el.textContent = text;
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

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function toBool(value, fallback = true) {
  if (value === true || value === false) return value;

  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;

  const text = String(value ?? '').trim().toLowerCase();

  if (text === 'true') return true;
  if (text === 'false') return false;

  return fallback;
}

function getSchoolDisplayName(session) {
  const fromSession =
    session?.user?.schoolName ||
    session?.user?.institutionName ||
    session?.user?.school_name ||
    session?.user?.institution_name ||
    session?.user?.tradingName ||
    session?.user?.fantasyName ||
    session?.user?.name;

  if (String(fromSession || '').trim()) {
    return String(fromSession).trim();
  }

  const storedUser = safeJsonParse(localStorage.getItem('user'));

  const fromStorage =
    storedUser?.schoolName ||
    storedUser?.institutionName ||
    storedUser?.school_name ||
    storedUser?.institution_name ||
    storedUser?.tradingName ||
    storedUser?.fantasyName ||
    storedUser?.name;

  if (String(fromStorage || '').trim()) {
    return String(fromStorage).trim();
  }

  return 'Escola';
}

function setBusy(el, on, busyText = 'Atualizando...') {
  if (!el) return;

  if (on) {
    if (!el.dataset.originalText) {
      el.dataset.originalText = el.textContent || '';
    }

    el.disabled = true;
    el.textContent = busyText;
    return;
  }

  el.disabled = false;

  if (el.dataset.originalText) {
    el.textContent = el.dataset.originalText;
  }
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function authFetchJson(path, { method = 'GET', body } = {}) {
  const res = await authFetch(
    `${API_URL}${path}`,
    {
      method,
      body: body ? JSON.stringify(body) : undefined,
    },
    { redirectTo: 'login-escola.html' }
  );

  if (!res.ok) {
    const msg = await readErrorMessage(res, `HTTP ${res.status}`);
    throw new Error(String(msg));
  }

  return readJsonSafe(res);
}

function unwrapList(data, keys = []) {
  if (!data) return [];

  if (Array.isArray(data)) return data;

  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }

  return [];
}

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

const editRoomOverlay = document.getElementById('editRoomOverlay');
const editRoomNameEl = document.getElementById('editRoomName');
const cancelEditRoomBtn = document.getElementById('cancelEditRoomBtn');
const saveEditRoomBtn = document.getElementById('saveEditRoomBtn');

async function apiCreateYear(name) {
  return authFetchJson(`${SCHOOL_API_BASE}/years`, {
    method: 'POST',
    body: { name },
  });
}

async function apiListYears() {
  return authFetchJson(`${SCHOOL_API_BASE}/years`);
}

async function apiUpdateYear(yearId, patch) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/years/${encodeURIComponent(String(yearId))}`,
    {
      method: 'PATCH',
      body: patch,
    }
  );
}

async function apiDeleteYear(yearId) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/years/${encodeURIComponent(String(yearId))}`,
    {
      method: 'DELETE',
    }
  );
}

async function apiCreateRoom(payload) {
  return authFetchJson(`${SCHOOL_API_BASE}/rooms`, {
    method: 'POST',
    body: payload,
  });
}

async function apiListRooms(yearId) {
  const q = yearId
    ? `?yearId=${encodeURIComponent(String(yearId))}`
    : '';

  return authFetchJson(`${SCHOOL_API_BASE}/rooms${q}`);
}

async function apiUpdateRoom(roomId, patch) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/rooms/${encodeURIComponent(String(roomId))}`,
    {
      method: 'PATCH',
      body: patch,
    }
  );
}

async function apiDeleteRoom(roomId) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/rooms/${encodeURIComponent(String(roomId))}`,
    {
      method: 'DELETE',
    }
  );
}

async function apiToggleRoom(roomId, isActive) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/rooms/${encodeURIComponent(String(roomId))}`,
    {
      method: 'PATCH',
      body: { isActive: !!isActive },
    }
  );
}

let cachedYears = [];
let cachedRooms = [];

let roomBeingEdited = null;

function openEditRoomModal(room) {
  roomBeingEdited = room;

  if (editRoomNameEl) {
    editRoomNameEl.value = room?.name || '';
  }

  if (editRoomOverlay) {
    editRoomOverlay.hidden = false;
  }

  setTimeout(() => {
    editRoomNameEl?.focus();
    editRoomNameEl?.select();
  }, 60);
}

function closeEditRoomModal() {
  roomBeingEdited = null;

  if (editRoomOverlay) {
    editRoomOverlay.hidden = true;
  }

  if (editRoomNameEl) {
    editRoomNameEl.value = '';
  }
}

async function saveRoomEdition() {
  if (!roomBeingEdited?.id) {
    notify('error', 'Erro', 'Sala inválida.');
    return;
  }

  const name = String(editRoomNameEl?.value || '').trim();

  if (!name) {
    notify('warn', 'Nome inválido', 'Informe um nome válido.');
    editRoomNameEl?.focus();
    return;
  }

  try {
    setBusy(saveEditRoomBtn, true, 'Salvando...');

    await apiUpdateRoom(roomBeingEdited.id, {
      name,
    });

    notify('success', 'Atualizado', 'Sala atualizada.');

    closeEditRoomModal();

    await refreshRooms({ keepStatus: true });
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
  } finally {
    setBusy(saveEditRoomBtn, false);
  }
}

if (cancelEditRoomBtn) {
  cancelEditRoomBtn.addEventListener('click', () => {
    closeEditRoomModal();
  });
}

if (saveEditRoomBtn) {
  saveEditRoomBtn.addEventListener('click', () => {
    saveRoomEdition();
  });
}

if (editRoomOverlay) {
  editRoomOverlay.addEventListener('click', (ev) => {
    if (ev.target === editRoomOverlay) {
      closeEditRoomModal();
    }
  });
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && editRoomOverlay && !editRoomOverlay.hidden) {
    closeEditRoomModal();
  }
});

function sortYearsMostRecentFirst(years) {
  return [...(Array.isArray(years) ? years : [])].sort((a, b) => {
    const nameA = String(a?.name || '').trim();
    const nameB = String(b?.name || '').trim();

    const numA = Number(nameA.replace(/[^\d]/g, '')) || 0;
    const numB = Number(nameB.replace(/[^\d]/g, '')) || 0;

    if (numA !== numB) return numB - numA;

    const dateA = a?.createdAt
      ? new Date(a.createdAt).getTime()
      : 0;

    const dateB = b?.createdAt
      ? new Date(b.createdAt).getTime()
      : 0;

    return dateB - dateA;
  });
}

function getDefaultYearId() {
  if (!cachedYears.length) return '';

  const ordered = sortYearsMostRecentFirst(cachedYears);

  const activeOrdered = ordered.filter(
    (y) => y.isActive === true
  );

  if (activeOrdered.length) {
    return String(activeOrdered[0].id);
  }

  return String(ordered[0].id);
}

function getYearNameById(yearId) {
  const year = cachedYears.find(
    (y) => String(y.id) === String(yearId)
  );

  return year?.name || '—';
}

function roomStatusText(isActive) {
  return isActive === false ? 'Inativa' : 'Ativa';
}

function updateRoomsAvailability() {
  const hasYears = cachedYears.length > 0;

  if (roomsSectionEl) {
    roomsSectionEl.style.display = '';
  }

  if (roomsBlockedNoteEl) {
    roomsBlockedNoteEl.style.display = hasYears
      ? 'none'
      : '';
  }

  if (createRoomAreaEl) {
    createRoomAreaEl.style.display = hasYears
      ? 'flex'
      : 'none';
  }

  if (createRoomBtn) createRoomBtn.disabled = !hasYears;
  if (roomYearSelectEl) roomYearSelectEl.disabled = !hasYears;
  if (roomsFilterYearSelectEl) {
    roomsFilterYearSelectEl.disabled = !hasYears;
  }

  if (!hasYears && roomsTbody) {
    roomsTbody.innerHTML =
      '<tr><td colspan="5" class="mk-muted">Cadastre ao menos um ano letivo para liberar o cadastro e a listagem filtrada de salas.</td></tr>';
  }
}

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

  const validIds = new Set(
    years.map((y) => String(y.id))
  );

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
  const currentCreateValue = String(
    roomYearSelectEl?.value || ''
  ).trim();

  const currentFilterValue = String(
    roomsFilterYearSelectEl?.value || ''
  ).trim();

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

  if (
    roomYearSelectEl &&
    !String(roomYearSelectEl.value || '').trim() &&
    defaultYearId
  ) {
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

function renderRoomsTable() {
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
      `<small class="mk-muted">Código: ${escapeHtml(r.code || '—')}</small><br>` +
      `<small class="mk-muted">Status: ${escapeHtml(
        roomStatusText(r.isActive)
      )}</small>`;

    const tdTeacher = document.createElement('td');

    tdTeacher.innerHTML =
      `<strong>${escapeHtml(
        r.teacherNameSnapshot || 'Professor'
      )}</strong>` +
      (r.teacherEmail
        ? `<br><small class="mk-muted">${escapeHtml(
            r.teacherEmail
          )}</small>`
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
      window.location.href =
        `desempenho-escola.html?roomId=${encodeURIComponent(
          String(r.id)
        )}`;
    };

    const btnEdit = document.createElement('button');

    btnEdit.type = 'button';
    btnEdit.textContent = 'Editar sala';

    btnEdit.onclick = () => {
      openEditRoomModal(r);
    };

    const btnToggle = document.createElement('button');

    btnToggle.type = 'button';

    btnToggle.textContent =
      r.isActive === false
        ? 'Ativar'
        : 'Desativar';

    btnToggle.onclick = async () => {
      try {
        await apiToggleRoom(r.id, !r.isActive);

        notify(
          'success',
          'Atualizado',
          `Sala ${
            r.isActive === false
              ? 'ativada'
              : 'desativada'
          }.`,
        );

        await refreshRooms({ keepStatus: true });
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
        await apiDeleteRoom(r.id);

        notify('success', 'Excluída', 'Sala removida.');

        await refreshRooms({ keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    wrap.appendChild(btnView);
    wrap.appendChild(btnEdit);
    wrap.appendChild(btnToggle);
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
