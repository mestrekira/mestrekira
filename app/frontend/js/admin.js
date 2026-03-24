import { API_URL } from './config.js';

const $ = (id) => document.getElementById(id);

const btnRefresh = $('btnRefresh');
const btnLogout = $('btnLogout');

const diagStatus = $('diagStatus');
const kpiUsers = $('kpiUsers');
const kpiRooms = $('kpiRooms');
const kpiTasks = $('kpiTasks');
const kpiEssays = $('kpiEssays');
const kpiWarned = $('kpiWarned');
const kpiScheduled = $('kpiScheduled');

const daysInput = $('daysInput');
const warnDaysInput = $('warnDaysInput');
const btnPreview = $('btnPreview');
const previewInfo = $('previewInfo');

const warnTableBody = $('warnTableBody');
const deleteTableBody = $('deleteTableBody');

const btnSendWarnings = $('btnSendWarnings');
const btnDeleteUsers = $('btnDeleteUsers');

const ADMIN_TOKEN_KEY = 'mk_admin_token';

let lastPreview = { warnList: [], deleteList: [] };

// --------------------------------------------------
// Auth helpers
// --------------------------------------------------

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function clearAdminTokenAndGoLogin() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.location.href = 'admin-login.html';
}

function setBusy(el, on, busyText = 'Processando...') {
  if (!el) return;
  if (on) {
    if (!el.dataset.originalText) el.dataset.originalText = el.textContent || '';
    el.disabled = true;
    el.textContent = busyText;
  } else {
    el.disabled = false;
    if (el.dataset.originalText) el.textContent = el.dataset.originalText;
  }
}

function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

function setStatus(message = '', isError = false) {
  if (!diagStatus) return;
  diagStatus.textContent = message;
  diagStatus.style.color = isError ? '#b91c1c' : '';
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function adminFetch(path, options = {}) {
  const token = getAdminToken();

  if (!token) {
    clearAdminTokenAndGoLogin();
    throw new Error('AUTH_NO_TOKEN');
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const body = options.body;
  if (body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: body && typeof body !== 'string' ? JSON.stringify(body) : body,
  });

  if (res.status === 401 || res.status === 403) {
    clearAdminTokenAndGoLogin();
    throw new Error(`AUTH_${res.status}`);
  }

  const data = await readJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  }

  return data;
}

// --------------------------------------------------
// Domain helpers
// --------------------------------------------------

function isStudent(user) {
  return String(user?.role || '').trim().toLowerCase() === 'student';
}

function normArray(value) {
  return Array.isArray(value) ? value : [];
}

function fmtDateBR(value) {
  if (!value) return '—';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toLocaleString('pt-BR');
  }
}

function pickId(user) {
  return user?.id ?? user?.userId ?? user?.studentId ?? '';
}

function pickName(user) {
  return user?.name || user?.fullName || user?.studentName || user?.email || 'Estudante';
}

function pickEmail(user) {
  return user?.email || user?.studentEmail || '—';
}

function pickLastAccess(user) {
  return (
    user?.lastActivityISO ||
    user?.lastAccessAt ||
    user?.lastLoginAt ||
    user?.lastSeenAt ||
    user?.updatedAt ||
    user?.createdAt ||
    null
  );
}

function pickInactiveDays(user) {
  if (user?.lastActivityISO) {
    const last = new Date(user.lastActivityISO);
    if (!Number.isNaN(last.getTime())) {
      const now = new Date();
      const diff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      return String(Math.max(0, diff));
    }
  }

  const value =
    user?.inactiveDays ??
    user?.daysInactive ??
    user?.inactive_for_days ??
    user?.days_without_access;

  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : String(num);
}

// --------------------------------------------------
// Render
// --------------------------------------------------

function rowTemplate(user, type) {
  const id = String(pickId(user));
  const name = pickName(user);
  const email = pickEmail(user);
  const lastAccess = fmtDateBR(pickLastAccess(user));
  const inactiveDays = pickInactiveDays(user);

  const checkboxClass = type === 'warn' ? 'warn-check' : 'delete-check';

  return `
    <tr>
      <td>
        <input type="checkbox" class="${checkboxClass}" value="${id}" checked />
      </td>
      <td>${name}</td>
      <td>${email}</td>
      <td><span class="pill pill-stud">Estudante</span></td>
      <td>${inactiveDays}</td>
      <td>${lastAccess}</td>
    </tr>
  `;
}

function renderTables(preview) {
  const warnList = normArray(preview?.warnList || preview?.warnCandidates).filter(isStudent);
  const deleteList = normArray(preview?.deleteList || preview?.deleteCandidates).filter(isStudent);

  lastPreview = { warnList, deleteList };

  if (warnTableBody) {
    warnTableBody.innerHTML =
      warnList.length === 0
        ? `<tr><td colspan="6" class="tbl-empty">Nenhum estudante candidato a aviso.</td></tr>`
        : warnList.map((u) => rowTemplate(u, 'warn')).join('');
  }

  if (deleteTableBody) {
    deleteTableBody.innerHTML =
      deleteList.length === 0
        ? `<tr><td colspan="6" class="tbl-empty">Nenhum estudante candidato a exclusão.</td></tr>`
        : deleteList.map((u) => rowTemplate(u, 'delete')).join('');
  }

  if (previewInfo) {
    previewInfo.textContent =
      `Prévia carregada: ${warnList.length} estudante(s) para aviso e ${deleteList.length} estudante(s) para exclusão.`;
  }
}

function renderCounts(counts = {}) {
  setText(kpiUsers, counts.users ?? counts.totalUsers ?? counts.students ?? 0, '0');
  setText(kpiRooms, counts.rooms ?? 0, '0');
  setText(kpiTasks, counts.tasks ?? counts.professors ?? 0, '0');
  setText(kpiEssays, counts.essays ?? counts.schools ?? 0, '0');
  setText(kpiWarned, counts.warned ?? counts.studentsFlagged ?? 0, '0');
  setText(kpiScheduled, counts.scheduled ?? counts.studentsScheduledForDeletion ?? 0, '0');
}

function getCheckedValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter((el) => el.checked)
    .map((el) => String(el.value || '').trim())
    .filter(Boolean);
}

// --------------------------------------------------
// API actions
// --------------------------------------------------

async function loadDiagnostics() {
  setStatus('Carregando diagnóstico...');

  const data = await adminFetch('/admin/diagnostics', { method: 'GET' });
  renderCounts(data?.counts || {});
  setStatus('Diagnóstico carregado.');
}

async function loadPreview() {
  const days = Number(daysInput?.value || 0);
  const warnDays = Number(warnDaysInput?.value || 0);

  if (!days || days < 1) {
    setStatus('Informe um valor válido para dias de exclusão.', true);
    return;
  }

  if (!warnDays || warnDays < 1) {
    setStatus('Informe um valor válido para dias de aviso.', true);
    return;
  }

  setBusy(btnPreview, true, 'Gerando prévia...');
  setStatus('Gerando prévia de inatividade...');

  try {
    const preview = await adminFetch('/admin/cleanup/preview', {
      method: 'POST',
      body: { days, warnDays },
    });

    renderTables(preview || {});
    setStatus('Prévia gerada com sucesso.');
  } finally {
    setBusy(btnPreview, false);
  }
}

async function sendWarnings() {
  const ids = getCheckedValues('.warn-check');

  if (ids.length === 0) {
    setStatus('Selecione pelo menos um estudante para aviso.', true);
    return;
  }

  const days = Number(daysInput?.value || 90);
  const warnDays = Number(warnDaysInput?.value || 7);

  setBusy(btnSendWarnings, true, 'Enviando avisos...');
  setStatus('Enviando avisos para estudantes...');

  try {
    const result = await adminFetch('/admin/cleanup/send-warnings', {
      method: 'POST',
      body: { userIds: ids, days, warnDays },
    });

    const sent = result?.sent ?? ids.length;
    setStatus(`Avisos enviados para ${sent} estudante(s).`);
    await Promise.allSettled([loadDiagnostics(), loadPreview()]);
  } finally {
    setBusy(btnSendWarnings, false);
  }
}

async function deleteUsers() {
  const ids = getCheckedValues('.delete-check');

  if (ids.length === 0) {
    setStatus('Selecione pelo menos um estudante para exclusão.', true);
    return;
  }

  const ok = window.confirm(
    `Tem certeza que deseja excluir ${ids.length} estudante(s) selecionado(s)? Esta ação não pode ser desfeita.`,
  );

  if (!ok) return;

  setBusy(btnDeleteUsers, true, 'Excluindo...');
  setStatus('Excluindo estudantes selecionados...');

  try {
    const result = await adminFetch('/admin/cleanup/delete-users', {
      method: 'POST',
      body: { userIds: ids },
    });

    const deleted = result?.deleted ?? ids.length;
    setStatus(`${deleted} estudante(s) excluído(s) com sucesso.`);
    await Promise.allSettled([loadDiagnostics(), loadPreview()]);
  } finally {
    setBusy(btnDeleteUsers, false);
  }
}

// --------------------------------------------------
// Events
// --------------------------------------------------

btnRefresh?.addEventListener('click', async () => {
  try {
    setBusy(btnRefresh, true, 'Atualizando...');
    await Promise.allSettled([loadDiagnostics(), loadPreview()]);
  } catch (err) {
    const msg = String(err?.message || '');
    if (!msg.startsWith('AUTH_')) {
      setStatus(msg || 'Erro ao atualizar painel.', true);
    }
  } finally {
    setBusy(btnRefresh, false);
  }
});

btnLogout?.addEventListener('click', () => {
  clearAdminTokenAndGoLogin();
});

btnPreview?.addEventListener('click', async () => {
  try {
    await loadPreview();
  } catch (err) {
    const msg = String(err?.message || '');
    if (!msg.startsWith('AUTH_')) {
      setStatus(msg || 'Erro ao gerar prévia.', true);
    }
  }
});

btnSendWarnings?.addEventListener('click', async () => {
  try {
    await sendWarnings();
  } catch (err) {
    const msg = String(err?.message || '');
    if (!msg.startsWith('AUTH_')) {
      setStatus(msg || 'Erro ao enviar avisos.', true);
    }
  }
});

btnDeleteUsers?.addEventListener('click', async () => {
  try {
    await deleteUsers();
  } catch (err) {
    const msg = String(err?.message || '');
    if (!msg.startsWith('AUTH_')) {
      setStatus(msg || 'Erro ao excluir estudantes.', true);
    }
  }
});

// --------------------------------------------------
// Init
// --------------------------------------------------

(async function init() {
  try {
    await loadDiagnostics();
  } catch (err) {
    const msg = String(err?.message || '');
    if (!msg.startsWith('AUTH_')) {
      setStatus(msg || 'Erro ao carregar diagnóstico.', true);
    }
    return;
  }

  const hasDays = Number(daysInput?.value || 0) > 0;
  const hasWarnDays = Number(warnDaysInput?.value || 0) > 0;

  if (hasDays && hasWarnDays) {
    try {
      await loadPreview();
    } catch (err) {
      const msg = String(err?.message || '');
      if (!msg.startsWith('AUTH_')) {
        setStatus(msg || 'Erro ao carregar prévia.', true);
      }
    }
  }
})();
