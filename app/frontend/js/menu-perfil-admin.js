// js/menu-perfil-admin.js
const ADMIN_TOKEN_KEY = 'mk_admin_token';
const ADMIN_PHOTO_KEY = 'mk_admin_photo';
const ADMIN_EMAIL_KEY = 'mk_admin_email'; // fallback

function safeParseJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function initMenuPerfilAdmin(opts = {}) {
  const loginRedirect = opts.loginRedirect || 'admin-login.html';

  const menuBtn = document.getElementById('menuBtn');
  const panel = document.getElementById('menuPanel');
  const closeBtn = document.getElementById('menuCloseBtn');

  const photoImg = document.getElementById('menuPhotoImg');
  const photoInput = document.getElementById('menuPhotoInput');

  const meName = document.getElementById('meName');
  const meEmail = document.getElementById('meEmail');
  const meRole = document.getElementById('meRole');

  const logoutBtn = document.getElementById('logoutMenuBtn');

  function open() {
    panel?.classList.add('open');
  }
  function close() {
    panel?.classList.remove('open');
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = loginRedirect;
  }

  // ---------- auth guard ----------
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    window.location.href = loginRedirect;
    return;
  }

  // ---------- preencher dados ----------
  const payload = safeParseJwt(token);
  const emailFromToken = payload?.email ? String(payload.email).trim().toLowerCase() : '';
  const email = emailFromToken || (localStorage.getItem(ADMIN_EMAIL_KEY) || '').trim().toLowerCase();

  if (meName) meName.textContent = 'Administrador(a)';
  if (meRole) meRole.textContent = 'Administrador(a)';
  if (meEmail) meEmail.textContent = email || '—';

  // guarda email para fallback em outras telas
  if (email) localStorage.setItem(ADMIN_EMAIL_KEY, email);

  // ---------- foto ----------
  function applyPhoto() {
    const saved = localStorage.getItem(ADMIN_PHOTO_KEY);
    if (photoImg) {
      photoImg.src = saved || 'logo1.png'; // fallback
    }
  }
  applyPhoto();

  photoInput?.addEventListener('change', async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    // limite simples pra não lotar storage
    if (file.size > 2_000_000) {
      alert('Imagem muito grande. Use até 2MB.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      localStorage.setItem(ADMIN_PHOTO_KEY, dataUrl);
      applyPhoto();
    } catch {
      alert('Não foi possível carregar a imagem.');
    }
  });

  // ---------- eventos ----------
  menuBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);

  // fecha clicando fora
  document.addEventListener('click', (e) => {
    if (!panel?.classList.contains('open')) return;
    const t = e.target;
    if (!t) return;
    const clickedInside = panel.contains(t) || menuBtn?.contains(t);
    if (!clickedInside) close();
  });

  // fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  logoutBtn?.addEventListener('click', logout);
}
