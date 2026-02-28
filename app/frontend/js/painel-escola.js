// painel-escola.js
import { API_URL } from './config.js';
import { toast } from './ui-feedback.js';

const LS = { token: 'token', user: 'user', schoolId: 'schoolId' };

const $ = (id) => document.getElementById(id);

const schoolNameEl = $('schoolName');
const schoolEmailEl = $('schoolEmail');
const statusEl = $('status');

const roomNameEl = $('roomName');
const teacherEmailEl = $('teacherEmail');
const btnCreateRoom = $('btnCreateRoom');

const btnRefresh = $('btnRefresh');
const btnLogout = $('btnLogout');
const roomsTbody = $('roomsTbody');

function notify(type, title, message, duration) {
  toast({
    type,
    title,
    message,
    duration: duration ?? (type === 'error' ? 3600 : type === 'warn' ? 3000 : 2400),
  });
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = String(msg || '');
}

function disable(el, v) {
  if (el) el.disabled = !!v;
}

function safeJsonParse(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function normRole(role) {
  return String(role || '').trim().toLowerCase();
}

async function readJsonSafe(res) {
  try { return await res.json(); } catch { return null; }
}

function ensureSchoolSession() {
  const token = localStorage.getItem(LS.token);
  const user = safeJsonParse(localStorage.getItem(LS.user));
  const role = normRole(user?.role);

  if (!token || role !== 'school') {
    notify('warn', 'Sessão inválida', 'Faça login como escola novamente.');
    window.location.replace('login-escola.html');
    return null;
  }
  return { token, user };
}

function renderRooms(rows) {
  if (!roomsTbody) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    roomsTbody.innerHTML = `<tr><td colspan="3">Nenhuma sala encontrada.</td></tr>`;
    return;
  }

  roomsTbody.innerHTML = rows.map((r) => {
    const avg = (r?.avgScore == null) ? '—' : String(r.avgScore);
    return `
      <tr>
        <td>${escapeHtml(r?.roomName || 'Sala')}</td>
        <td>${escapeHtml(r?.teacherName || '')}<div class="muted">${escapeHtml(r?.teacherEmail || '')}</div></td>
        <td style="text-align:right;">${escapeHtml(avg)}</td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function carregarResumo() {
  const sess = ensureSchoolSession();
  if (!sess) return;

  setStatus('Carregando...');
  disable(btnRefresh, true);

  try {
    const res = await fetch(`${API_URL}/school-dashboard/rooms-summary`, {
      headers: { Authorization: `Bearer ${sess.token}` },
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data?.ok) {
      const msg = data?.message || data?.error || 'Não foi possível carregar o resumo.';
      notify('error', 'Erro', msg);
      setStatus(msg);
      return;
    }

    // Atualiza perfil
    const me = data?.school || sess.user;
    if (schoolNameEl) schoolNameEl.textContent = me?.name || '—';
    if (schoolEmailEl) schoolEmailEl.textContent = me?.email || '—';

    renderRooms(data?.rooms || []);
    setStatus('');
  } catch {
    notify('error', 'Erro de conexão', 'Não foi possível acessar o servidor agora.');
    setStatus('Erro de conexão.');
  } finally {
    disable(btnRefresh, false);
  }
}

async function criarSala() {
  const sess = ensureSchoolSession();
  if (!sess) return;

  const roomName = String(roomNameEl?.value || '').trim();
  const teacherEmail = String(teacherEmailEl?.value || '').trim().toLowerCase();

  if (!roomName || !teacherEmail || !teacherEmail.includes('@')) {
    notify('warn', 'Dados obrigatórios', 'Informe nome da sala e e-mail do professor.');
    return;
  }

  disable(btnCreateRoom, true);
  notify('info', 'Criando...', 'Cadastrando sala...', 1800);

  try {
    const res = await fetch(`${API_URL}/school-dashboard/create-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sess.token}`,
      },
      body: JSON.stringify({ roomName, teacherEmail }),
    });

    const data = await readJsonSafe(res);

    if (!res.ok || !data?.ok) {
      const msg = data?.message || data?.error || 'Não foi possível criar a sala.';
      notify('error', 'Erro', msg);
      return;
    }

    notify('success', 'Sala criada', 'Sala cadastrada com sucesso.');
    if (roomNameEl) roomNameEl.value = '';
    // mantém teacherEmail (você pode querer cadastrar várias)
    await carregarResumo();
  } catch {
    notify('error', 'Erro de conexão', 'Tente novamente em instantes.');
  } finally {
    disable(btnCreateRoom, false);
  }
}

function logout() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  localStorage.removeItem(LS.schoolId);
  notify('info', 'Saindo...', 'Sessão encerrada.');
  window.location.replace('index.html');
}

document.addEventListener('DOMContentLoaded', () => {
  const sess = ensureSchoolSession();
  if (!sess) return;

  // profile quick
  if (schoolNameEl) schoolNameEl.textContent = sess.user?.name || '—';
  if (schoolEmailEl) schoolEmailEl.textContent = sess.user?.email || '—';

  btnRefresh?.addEventListener('click', carregarResumo);
  btnLogout?.addEventListener('click', logout);
  btnCreateRoom?.addEventListener('click', criarSala);

  teacherEmailEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') criarSala();
  });

  carregarResumo();
});
