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

const btnSelectAllWarn = $('btnSelectAllWarn');
const btnClearWarn = $('btnClearWarn');
const btnSendWarnings = $('btnSendWarnings');

const btnSelectAllDelete = $('btnSelectAllDelete');
const btnClearDelete = $('btnClearDelete');
const btnDeleteUsers = $('btnDeleteUsers');

function getAdminToken() {
  return localStorage.getItem('adminToken') || '';
}

function setStatusChip(el, text, kind = 'muted') {
  el.textContent = text;
  el.className = `chip chip-${kind}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      .format(new Date(iso));
  } catch {
    return '—';
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // token inválido/expirado
    localStorage.removeItem('adminToken');
    window.location.href = 'admin-login.html';
    return null;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || 'Falha na requisição.';
    throw new Error(msg);
  }
  return data;
}

let lastPreview = { warnList: [], deleteList: [] };

function rowTemplate(u, type) {
  // type: 'warn' | 'delete'
  const id = String(u.id || '');
  const name = String(u.name || '');
  const email = String(u.email || '');
  const role = String(u.role || '').toLowerCase();

  const lastActivity = u.lastActivityISO || u.lastActivity || u.last_activity || null;
  const deleteAt =
    type === 'warn'
      ? (u.deleteAtISO || u.computedDeleteAt || null)
      : (u.scheduledDeletionAtISO || u.scheduledDeletionAt || u.deleteAtISO || null);

  const badge =
    role === 'professor' ? `<span class="pill pill-prof">Professor</span>`
    : role === 'student' ? `<span class="pill pill-stud">Estudante</span>`
    : `<span class="pill">Outro</span>`;

  return `
    <tr>
      <td class="chk">
        <input type="checkbox" data-id="${id}" />
      </td>
      <td class="cell-strong">${escapeHtml(name)}</td>
      <td class="cell-mono">${escapeHtml(email)}</td>
      <td>${badge}</td>
      <td class="cell-mono">${escapeHtml(fmtDate(lastActivity))}</td>
      <td class="cell-mono">${escapeHtml(fmtDate(deleteAt))}</td>
    </tr>
  `;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTables(preview) {
  const warnList = Array.isArray(preview?.warnList) ? preview.warnList : [];
  const deleteList = Array.isArray(preview?.deleteList) ? preview.deleteList : [];

  lastPreview = { warnList, deleteList };

  warnTableBody.innerHTML =
    warnList.length === 0
      ? `<tr><td colspan="6" class="tbl-empty">Nenhum candidato a aviso.</td></tr>`
      : warnList.map((u) => rowTemplate(u, 'warn')).join('');

  deleteTableBody.innerHTML =
    deleteList.length === 0
      ? `<tr><td colspan="6" class="tbl-empty">Nenhum candidato a exclusão.</td></tr>`
      : deleteList.map((u) => rowTemplate(u, 'delete')).join('');
}

function getCheckedIds(tbodyEl) {
  return Array.from(tbodyEl.querySelectorAll('input[type="checkbox"]:checked'))
    .map((el) => el.getAttribute('data-id'))
    .filter(Boolean);
}

function setAllCheckboxes(tbodyEl, checked) {
  Array.from(tbodyEl.querySelectorAll('input[type="checkbox"]'))
    .forEach((el) => { el.checked = checked; });
}

async function loadDiagnostics() {
  setStatusChip(diagStatus, 'Carregando…', 'muted');

  const data = await api('/admin/diagnostics');
  if (!data) return;

  kpiUsers.textContent = data?.counts?.users ?? '—';
  kpiRooms.textContent = data?.counts?.rooms ?? '—';
  kpiTasks.textContent = data?.counts?.tasks ?? '—';
  kpiEssays.textContent = data?.counts?.essays ?? '—';
  kpiWarned.textContent = data?.inactivity?.warned ?? '—';
  kpiScheduled.textContent = data?.inactivity?.scheduledForDeletion ?? '—';

  setStatusChip(diagStatus, 'Online', 'ok');
}

async function runPreview() {
  const days = Number(daysInput.value || 90);
  const warnDays = Number(warnDaysInput.value || 7);

  previewInfo.textContent = 'Gerando prévia…';

  const data = await api('/admin/cleanup/preview', {
    method: 'POST',
    body: { days, warnDays },
  });
  if (!data) return;

  const w = data?.warnList?.length ?? 0;
  const d = data?.deleteList?.length ?? 0;
  previewInfo.textContent = `Prévia gerada em ${fmtDate(data?.now)} • Avisar: ${w} • Excluir: ${d}`;

  renderTables(data);
}

async function sendWarnings() {
  const ids = getCheckedIds(warnTableBody);
  if (ids.length === 0) {
    alert('Selecione ao menos 1 usuário para enviar aviso.');
    return;
  }

  const days = Number(daysInput.value || 90);
  const warnDays = Number(warnDaysInput.value || 7);

  if (!confirm(`Enviar aviso de inatividade para ${ids.length} usuário(s)?`)) return;

  btnSendWarnings.disabled = true;
  btnSendWarnings.textContent = 'Enviando…';

  try {
    await api('/admin/cleanup/send-warnings', {
      method: 'POST',
      body: { userIds: ids, days, warnDays },
    });

    alert('Ação concluída. Atualize a prévia.');
    await loadDiagnostics();
    await runPreview();
  } finally {
    btnSendWarnings.disabled = false;
    btnSendWarnings.textContent = 'Enviar avisos';
  }
}

async function deleteUsers() {
  const ids = getCheckedIds(deleteTableBody);
  if (ids.length === 0) {
    alert('Selecione ao menos 1 usuário para excluir.');
    return;
  }

  if (!confirm(`EXCLUIR ${ids.length} usuário(s)? Isso removerá dados vinculados.`)) return;

  btnDeleteUsers.disabled = true;
  btnDeleteUsers.textContent = 'Excluindo…';

  try {
    await api('/admin/cleanup/delete-users', {
      method: 'POST',
      body: { userIds: ids },
    });

    alert('Exclusão concluída. Atualize a prévia.');
    await loadDiagnostics();
    await runPreview();
  } finally {
    btnDeleteUsers.disabled = false;
    btnDeleteUsers.textContent = 'Excluir selecionados';
  }
}

function logoutAdmin() {
  localStorage.removeItem('adminToken');
  window.location.href = 'admin-login.html';
}

// eventos
btnRefresh?.addEventListener('click', async () => {
  await loadDiagnostics();
  // não força preview, só se já tiver listado
});

btnLogout?.addEventListener('click', logoutAdmin);

btnPreview?.addEventListener('click', async () => {
  await runPreview();
});

btnSelectAllWarn?.addEventListener('click', () => setAllCheckboxes(warnTableBody, true));
btnClearWarn?.addEventListener('click', () => setAllCheckboxes(warnTableBody, false));
btnSendWarnings?.addEventListener('click', sendWarnings);

btnSelectAllDelete?.addEventListener('click', () => setAllCheckboxes(deleteTableBody, true));
btnClearDelete?.addEventListener('click', () => setAllCheckboxes(deleteTableBody, false));
btnDeleteUsers?.addEventListener('click', deleteUsers);

// init
(async function init() {
  const token = getAdminToken();
  if (!token) {
    window.location.href = 'admin-login.html';
    return;
  }
  await loadDiagnostics();
})();
