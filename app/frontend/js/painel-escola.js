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

function confirmDialog({
  title = 'Confirmar ação',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';

    const h3 = document.createElement('h3');
    h3.textContent = title;

    const p = document.createElement('p');
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-outline';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger ? 'btn-danger' : 'btn-outline';
    confirmBtn.textContent = confirmText;

    function close(value) {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
      resolve(value);
    }

    function onKeyDown(ev) {
      if (ev.key === 'Escape') {
        close(false);
      }
    }

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        close(false);
      }
    });

    document.addEventListener('keydown', onKeyDown);

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    modal.appendChild(h3);
    modal.appendChild(p);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(() => {
      confirmBtn.focus();
    }, 60);
  });
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

const teachersTbody = document.getElementById('teachersTbody');

const roomsSectionEl = document.getElementById('roomsSection');
const createRoomAreaEl = document.getElementById('createRoomArea');
const roomsBlockedNoteEl = document.getElementById('roomsBlockedNote');

const editRoomOverlay = document.getElementById('editRoomOverlay');
const editRoomNameEl = document.getElementById('editRoomName');
const editTeacherNameEl = document.getElementById('editTeacherName');
const editTeacherEmailEl = document.getElementById('editTeacherEmail');
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

async function apiListTeachers() {
  return authFetchJson(`${SCHOOL_API_BASE}/teachers`);
}

async function apiDeactivateTeacher(id) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/teachers/${encodeURIComponent(String(id))}/deactivate`,
    {
      method: 'PATCH',
    }
  );
}

async function apiDeleteTeacher(id) {
  return authFetchJson(
    `${SCHOOL_API_BASE}/teachers/${encodeURIComponent(String(id))}`,
    {
      method: 'DELETE',
    }
  );
}

let cachedYears = [];
let cachedRooms = [];
let cachedTeachers = [];

let roomBeingEdited = null;

function openEditRoomModal(room) {
  roomBeingEdited = room;

  if (editRoomNameEl) {
    editRoomNameEl.value = room?.name || '';
  }

  if (editTeacherNameEl) {
    editTeacherNameEl.value =
      room?.teacherNameSnapshot || '';
  }

  if (editTeacherEmailEl) {
    editTeacherEmailEl.value =
      room?.teacherEmail || '';
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

  if (editTeacherNameEl) {
    editTeacherNameEl.value = '';
  }

  if (editTeacherEmailEl) {
    editTeacherEmailEl.value = '';
  }
}

async function saveRoomEdition() {
  if (!roomBeingEdited?.id) {
    notify('error', 'Erro', 'Sala inválida.');
    return;
  }

  const name = String(
    editRoomNameEl?.value || ''
  ).trim();

  const teacherName = String(
    editTeacherNameEl?.value || ''
  ).trim();

  const teacherEmail = String(
    editTeacherEmailEl?.value || ''
  )
    .trim()
    .toLowerCase();

  if (!name) {
    notify(
      'warn',
      'Nome inválido',
      'Informe um nome válido.'
    );

    editRoomNameEl?.focus();
    return;
  }

  if (!teacherEmail) {
    notify(
      'warn',
      'E-mail obrigatório',
      'Informe o e-mail do professor.'
    );

    editTeacherEmailEl?.focus();
    return;
  }

  try {
    setBusy(saveEditRoomBtn, true, 'Salvando...');

    await apiUpdateRoom(roomBeingEdited.id, {
      name,
      teacherName,
      teacherEmail,
    });

    notify('success', 'Atualizado', 'Sala atualizada.');

    closeEditRoomModal();

    await refreshRooms({ keepStatus: true });
    await refreshTeachers({ keepStatus: true });
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

function teacherStatusText(isActive) {
  return isActive === false ? 'Inativo' : 'Ativo';
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
        await refreshTeachers({ keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnDelete = document.createElement('button');

    btnDelete.type = 'button';
    btnDelete.className = 'danger';
    btnDelete.textContent = 'Excluir';

    btnDelete.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Excluir sala',
        message: `Deseja excluir a sala "${r.name}"? Essa ação pode falhar se o backend não permitir deletar salas com tarefas ou matrículas.`,
        confirmText: 'Excluir sala',
        cancelText: 'Cancelar',
        danger: true,
      });

      if (!ok) return;

      try {
        await apiDeleteRoom(r.id);

        notify('success', 'Excluída', 'Sala removida.');

        await refreshRooms({ keepStatus: true });
        await refreshTeachers({ keepStatus: true });
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

function renderTeachersTable() {
  if (!teachersTbody) return;

  teachersTbody.innerHTML = '';

  if (!cachedTeachers.length) {
    teachersTbody.innerHTML =
      '<tr><td colspan="5" class="mk-muted">Nenhum professor vinculado à escola ainda.</td></tr>';

    return;
  }

  cachedTeachers.forEach((teacher) => {
    const tr = document.createElement('tr');

    const tdTeacher = document.createElement('td');
    tdTeacher.innerHTML =
      `<strong>${escapeHtml(teacher.name || 'Professor')}</strong>` +
      (teacher.mustChangePassword
        ? '<br><small class="mk-muted">Senha temporária pendente de troca</small>'
        : '');

    const tdEmail = document.createElement('td');
    tdEmail.textContent = teacher.email || '—';

    const tdRooms = document.createElement('td');
    tdRooms.innerHTML =
      `<strong>Salas: ${Number(teacher.roomsTotal || 0)}</strong><br>` +
      `<small class="mk-muted">Ativas: ${Number(teacher.activeRooms || 0)} | Inativas: ${Number(teacher.inactiveRooms || 0)}</small>`;

    if (Array.isArray(teacher.rooms) && teacher.rooms.length) {
      const roomsText = teacher.rooms
        .map((room) => `${room.name || 'Sala'} (${room.isActive === false ? 'inativa' : 'ativa'})`)
        .join(', ');

      tdRooms.innerHTML += `<br><small class="mk-muted">${escapeHtml(roomsText)}</small>`;
    }

    const tdStatus = document.createElement('td');

    const badge = document.createElement('span');
    const active = teacher.isActive !== false;

    badge.className = `mk-badge ${active ? 'on' : 'off'}`;
    badge.textContent = teacherStatusText(active);

    tdStatus.appendChild(badge);

    const tdActions = document.createElement('td');

    const wrap = document.createElement('div');
    wrap.className = 'mk-actions';

    const btnDeactivate = document.createElement('button');
    btnDeactivate.type = 'button';
    btnDeactivate.textContent = 'Desativar';

    const canDeactivate = teacher.canDeactivate === true && active;

    btnDeactivate.disabled = !canDeactivate;
    btnDeactivate.title = canDeactivate
      ? 'Desativar professor'
      : 'O professor só pode ser desativado se estiver ativo e não possuir salas ativas.';

    btnDeactivate.onclick = async () => {
      if (!canDeactivate) return;

      const ok = await confirmDialog({
        title: 'Desativar professor',
        message: `Deseja desativar o professor "${teacher.name}"? A conta não será apagada e o histórico será preservado.`,
        confirmText: 'Desativar',
        cancelText: 'Cancelar',
        danger: true,
      });

      if (!ok) return;

      try {
        await apiDeactivateTeacher(teacher.id);

        notify(
          'success',
          'Professor desativado',
          'O professor foi marcado como inativo.',
        );

        await refreshTeachers({ keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'danger';
    btnDelete.textContent = 'Excluir';

    const canDelete = teacher.canDelete === true;

    btnDelete.disabled = !canDelete;
    btnDelete.title = canDelete
      ? 'Excluir professor'
      : 'O professor só pode ser excluído se não possuir nenhuma sala vinculada.';

    btnDelete.onclick = async () => {
      if (!canDelete) return;

      const ok = await confirmDialog({
        title: 'Excluir professor',
        message: `Deseja excluir definitivamente o professor "${teacher.name}"? Use essa opção somente se ele não tiver nenhuma sala vinculada.`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        danger: true,
      });

      if (!ok) return;

      try {
        await apiDeleteTeacher(teacher.id);

        notify(
          'success',
          'Professor excluído',
          'A conta do professor foi removida.',
        );

        await refreshTeachers({ keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    wrap.appendChild(btnDeactivate);
    wrap.appendChild(btnDelete);

    tdActions.appendChild(wrap);

    tr.appendChild(tdTeacher);
    tr.appendChild(tdEmail);
    tr.appendChild(tdRooms);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    teachersTbody.appendChild(tr);
  });
}

function renderYearsTable() {
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
    const on = y.isActive === true;

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
        await apiUpdateYear(y.id, { name: n });

        notify('success', 'Atualizado', 'Ano letivo renomeado.');

        await refreshAll({ keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.textContent = on ? 'Desativar' : 'Ativar';

    btnToggle.onclick = async () => {
      try {
        await apiUpdateYear(y.id, { isActive: !on });

        notify(
          'success',
          'Atualizado',
          `Ano letivo ${!on ? 'ativado' : 'desativado'}.`,
        );

        await refreshAll({ keepStatus: true });
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'danger';
    btnDelete.textContent = 'Excluir';

    btnDelete.onclick = async () => {
      const ok = await confirmDialog({
        title: 'Excluir ano letivo',
        message: `Deseja excluir o ano letivo "${y.name}"? As salas desse ano serão mantidas, mas ficarão sem ano letivo.`,
        confirmText: 'Excluir ano',
        cancelText: 'Cancelar',
        danger: true,
      });

      if (!ok) return;

      try {
        await apiDeleteYear(y.id);

        notify('success', 'Excluído', 'Ano letivo removido.');

        await refreshAll({ keepStatus: true });
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

async function refreshYears({ keepStatus } = {}) {
  if (!keepStatus) {
    setStatus('Carregando anos letivos...');
  }

  const res = await apiListYears();
  const years = unwrapList(res, ['years']);

  cachedYears = (Array.isArray(years) ? years : [])
    .filter((y) => y && y.id)
    .map((y) => ({
      id: String(y.id),
      name: String(y.name || '').trim(),
      isActive: toBool(y.isActive, true),
      createdAt: y.createdAt || y.created_at || null,
    }));

  syncYearSelects();
  renderYearsTable();
  updateRoomsAvailability();

  if (!keepStatus) {
    setStatus('');
  }
}

async function refreshRooms({ keepStatus } = {}) {
  if (!cachedYears.length) {
    cachedRooms = [];
    renderRoomsTable();
    return;
  }

  if (!keepStatus) {
    setStatus('Carregando salas...');
  }

  const yearId = roomsFilterYearSelectEl
    ? String(roomsFilterYearSelectEl.value || '').trim()
    : '';

  const res = await apiListRooms(yearId || null);
  const rooms = unwrapList(res, ['rooms']);

  cachedRooms = (Array.isArray(rooms) ? rooms : []).map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    teacherId: r.teacherId || r.teacher_id || null,
    teacherNameSnapshot: r.teacherNameSnapshot || r.teacher_name_snapshot || '',
    teacherEmail: r.teacherEmail || r.teacher_email || '',
    schoolYearId: r.schoolYearId || r.school_year_id || null,
    createdAt: r.createdAt || r.created_at || null,
    isActive: r.isActive !== false,
    deactivatedAt: r.deactivatedAt || r.deactivated_at || null,
  }));

  renderRoomsTable();

  if (!keepStatus) {
    setStatus('');
  }
}

async function refreshTeachers({ keepStatus } = {}) {
  if (!teachersTbody) return;

  if (!keepStatus) {
    setStatus('Carregando professores...');
  }

  const res = await apiListTeachers();
  const teachers = unwrapList(res, ['teachers']);

  cachedTeachers = (Array.isArray(teachers) ? teachers : [])
    .filter((teacher) => teacher && teacher.id)
    .map((teacher) => ({
      id: String(teacher.id),
      name: String(teacher.name || '').trim(),
      email: String(teacher.email || '').trim(),
      isActive: teacher.isActive !== false,
      professorType: teacher.professorType || teacher.professor_type || null,
      schoolId: teacher.schoolId || teacher.school_id || null,
      mustChangePassword: teacher.mustChangePassword === true || teacher.must_change_password === true,
      roomsTotal: Number(teacher.roomsTotal ?? teacher.rooms_total ?? 0),
      activeRooms: Number(teacher.activeRooms ?? teacher.active_rooms ?? 0),
      inactiveRooms: Number(teacher.inactiveRooms ?? teacher.inactive_rooms ?? 0),
      canDeactivate: teacher.canDeactivate === true || teacher.can_deactivate === true,
      canDelete: teacher.canDelete === true || teacher.can_delete === true,
      rooms: Array.isArray(teacher.rooms)
        ? teacher.rooms.map((room) => ({
            id: String(room.id || ''),
            name: String(room.name || '').trim(),
            isActive: room.isActive !== false,
          }))
        : [],
    }));

  renderTeachersTable();

  if (!keepStatus) {
    setStatus('');
  }
}

async function refreshAll({ keepStatus } = {}) {
  await refreshYears({ keepStatus: true });
  await refreshRooms({ keepStatus: true });
  await refreshTeachers({ keepStatus: true });

  if (!keepStatus) {
    setStatus('');
  }
}

async function onCreateYear() {
  const name = String(yearNameEl?.value || '').trim();

  if (!name) {
    notify('warn', 'Campos obrigatórios', 'Informe o nome do ano letivo.');
    return;
  }

  try {
    setStatus('');

    await apiCreateYear(name);

    if (yearNameEl) {
      yearNameEl.value = '';
    }

    notify('success', 'Criado', 'Ano letivo cadastrado.');

    await refreshAll({ keepStatus: true });

    const defaultYearId = getDefaultYearId();

    if (roomYearSelectEl && defaultYearId) {
      roomYearSelectEl.value = defaultYearId;
    }

    if (roomsFilterYearSelectEl && defaultYearId) {
      roomsFilterYearSelectEl.value = defaultYearId;
    }

    setStatus('');
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
    setStatus('');
  }
}

async function onCreateRoom() {
  const name = String(roomNameEl?.value || '').trim();
  const teacherName = String(teacherNameEl?.value || '').trim();
  const teacherEmail = String(teacherEmailEl?.value || '').trim().toLowerCase();

  let yearId = roomYearSelectEl
    ? String(roomYearSelectEl.value || '').trim()
    : '';

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
    setStatus('Criando sala...');

    await apiCreateRoom({
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

    await refreshRooms({ keepStatus: true });
    await refreshTeachers({ keepStatus: true });

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

document.addEventListener('DOMContentLoaded', async () => {
  const session = requireSchoolSession({
    redirectTo: 'login-escola.html',
  });

  setText(schoolNameEl, getSchoolDisplayName(session));

  if (createYearBtn) {
    createYearBtn.addEventListener('click', () => onCreateYear());
  }

  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => onCreateRoom());
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        setBusy(refreshBtn, true, 'Atualizando...');
        setStatus('Atualizando painel...');

        await refreshAll({ keepStatus: true });

        setText(schoolNameEl, getSchoolDisplayName(session));
        setStatus('Painel atualizado com sucesso.');
      } catch (e) {
        const msg = String(e?.message || e);

        console.error(e);

        setStatus('Erro ao atualizar painel.');
        notify('error', 'Erro', msg || 'Falha ao atualizar painel.');
      } finally {
        setBusy(refreshBtn, false);
      }
    });
  }

  if (roomsFilterYearSelectEl) {
    roomsFilterYearSelectEl.addEventListener('change', () => refreshRooms());
  }

  try {
    await refreshAll();

    setText(schoolNameEl, getSchoolDisplayName(session));
  } catch (e) {
    console.error(e);

    const msg = String(e?.message || e);

    if (msg.includes('Rota não encontrada')) {
      setStatus('Erro ao carregar painel.');

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


