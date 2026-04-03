import { API_URL } from './config.js';
import {
  notify,
  requireSchoolSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

const SCHOOL_API_BASE = '/school-dashboard';

// ------------------- Helpers -------------------
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

// ✅ NOVO — conversão segura de boolean
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

// ------------------- API -------------------
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
  return authFetchJson(`${SCHOOL_API_BASE}/years/${encodeURIComponent(String(yearId))}`, {
    method: 'PATCH',
    body: patch,
  });
}

async function apiDeleteYear(yearId) {
  return authFetchJson(`${SCHOOL_API_BASE}/years/${encodeURIComponent(String(yearId))}`, {
    method: 'DELETE',
  });
}

// ------------------- Estado -------------------
let cachedYears = [];

// ------------------- Render -------------------
function renderYearsTable() {
  if (!yearsTbody) return;

  yearsTbody.innerHTML = '';

  if (!cachedYears.length) {
    yearsTbody.innerHTML =
      '<tr><td colspan="4" class="mk-muted">Nenhum ano letivo cadastrado.</td></tr>';
    return;
  }

  cachedYears.forEach((y) => {
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

    const btnToggle = document.createElement('button');
    btnToggle.textContent = on ? 'Desativar' : 'Ativar';

    btnToggle.onclick = async () => {
      try {
        await apiUpdateYear(y.id, { isActive: !on });

        notify(
          'success',
          'Atualizado',
          `Ano letivo ${!on ? 'ativado' : 'desativado'}.`
        );

        await refreshYears();
      } catch (e) {
        notify('error', 'Erro', String(e?.message || e));
      }
    };

    tdActions.appendChild(btnToggle);

    tr.appendChild(tdName);
    tr.appendChild(tdStatus);
    tr.appendChild(tdCreated);
    tr.appendChild(tdActions);

    yearsTbody.appendChild(tr);
  });
}

// ------------------- Loader -------------------
async function refreshYears() {
  const res = await apiListYears();
  const years = unwrapList(res, ['years']);

  cachedYears = (Array.isArray(years) ? years : []).map((y) => ({
    id: String(y.id),
    name: String(y.name || '').trim(),

    isActive: toBool(y.isActive, true),

    createdAt: y.createdAt || null,
  }));

  renderYearsTable();
}

document.addEventListener('DOMContentLoaded', async () => {
  requireSchoolSession({ redirectTo: 'login-escola.html' });

  try {
    await refreshYears();
  } catch (e) {
    notify('error', 'Erro', String(e?.message || e));
  }
});
