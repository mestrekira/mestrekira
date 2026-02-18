import { API_URL } from './config.js';

const ADMIN_TOKEN_KEY = 'mk_admin_token';

function getToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}
function clearToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function qs(id) { return document.getElementById(id); }

export async function initMenuPerfilAdmin({ loginRedirect = 'admin-login.html' } = {}) {
  const menuBtn = qs('menuBtn');
  const menuPanel = qs('menuPanel');
  const menuCloseBtn = qs('menuCloseBtn');
  const logoutBtn = qs('logoutMenuBtn');

  const meEmail = qs('meEmail'); // no HTML você já fixou nome/role

  function open() { menuPanel?.classList.add('open'); }
  function close() { menuPanel?.classList.remove('open'); }

  menuBtn?.addEventListener('click', open);
  menuCloseBtn?.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // ✅ Carrega "me" do admin via token
  const token = getToken();
  if (!token) {
    window.location.href = loginRedirect;
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearToken();
      window.location.href = loginRedirect;
      return;
    }

    const data = await res.json().catch(() => null);
    if (meEmail) meEmail.textContent = data?.email || data?.admin?.email || '—';
  } catch {
    // Se API offline, não entra em loop automaticamente.
    // Você pode opcionalmente mostrar um aviso.
    if (meEmail) meEmail.textContent = '—';
  }

  logoutBtn?.addEventListener('click', () => {
    clearToken();
    window.location.href = loginRedirect;
  });
}
