import { API_URL } from './config.js';

const ADMIN_TOKEN_KEY = 'mk_admin_token';

const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const menuCloseBtn = document.getElementById('menuCloseBtn');

const meName = document.getElementById('meName');
const meEmail = document.getElementById('meEmail');

const newEmail = document.getElementById('newEmail');
const newPass = document.getElementById('newPass');
const saveBtn = document.getElementById('saveProfileBtn');
const statusEl = document.getElementById('menuStatus');

const logoutBtn = document.getElementById('logoutMenuBtn');

const menuPhotoImg = document.getElementById('menuPhotoImg');
const menuPhotoInput = document.getElementById('menuPhotoInput');

function token() {
  return String(localStorage.getItem(ADMIN_TOKEN_KEY) || '').trim();
}

function setStatus(t) {
  statusEl.textContent = t || '';
}

function openMenu() {
  menuPanel.classList.add('open');
}

function closeMenu() {
  menuPanel.classList.remove('open');
}

menuBtn?.addEventListener('click', openMenu);
menuCloseBtn?.addEventListener('click', closeMenu);

async function adminFetch(path, options = {}) {
  const t = token();
  if (!t) throw new Error('Sem token admin.');

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${t}`,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.message || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function loadMe() {
  const me = await adminFetch('/admin/me', { method: 'GET' });
  meName.textContent = me?.name || 'Administrador(a)';
  meEmail.textContent = me?.email || '—';

  // foto (se existir url)
  if (me?.photoUrl) {
    menuPhotoImg.src = me.photoUrl;
  } else {
    menuPhotoImg.src = 'logo1.png';
  }
}

async function saveProfile() {
  setStatus('Salvando...');
  const email = String(newEmail.value || '').trim();
  const password = String(newPass.value || '');

  if (!email && !password) {
    setStatus('Nada para atualizar.');
    return;
  }

  const body = {};
  if (email) body.email = email;
  if (password) body.password = password;

  await adminFetch('/admin/me', {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  });

  newEmail.value = '';
  newPass.value = '';
  setStatus('Atualizado com sucesso.');
  await loadMe();
}

async function uploadPhoto(file) {
  if (!file) return;

  const form = new FormData();
  form.append('photo', file);

  setStatus('Enviando foto...');
  const res = await fetch(`${API_URL}/admin/me/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
    body: form
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    setStatus(data?.message || 'Falha ao enviar foto.');
    return;
  }

  setStatus('Foto atualizada.');
  await loadMe();
}

saveBtn?.addEventListener('click', () => {
  saveProfile().catch((e) => setStatus(e.message));
});

logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.location.href = 'admin-login.html';
});

menuPhotoInput?.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  uploadPhoto(f);
});

(async () => {
  try {
    if (!token()) return (window.location.href = 'admin-login.html');
    await loadMe();
  } catch {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = 'admin-login.html';
  }
})();
