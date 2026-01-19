import { API_URL } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function safeText(el, value, fallback = '—') {
  if (!el) return;
  el.textContent = value !== undefined && value !== null && String(value).trim() !== ''
    ? String(value)
    : fallback;
}

function getRoleAndId() {
  const professorId = localStorage.getItem('professorId');
  const studentId = localStorage.getItem('studentId');

  if (professorId && professorId !== 'undefined' && professorId !== 'null') {
    return { role: 'professor', id: professorId };
  }
  if (studentId && studentId !== 'undefined' && studentId !== 'null') {
    return { role: 'student', id: studentId };
  }
  return { role: null, id: null };
}

function photoKey(role, id) {
  return role && id ? `mk_photo_${role}_${id}` : 'mk_photo_guest';
}

function loadPhoto(role, id) {
  const img = $('menuPhotoImg');
  if (!img) return;

  const key = photoKey(role, id);
  const dataUrl = localStorage.getItem(key);

  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = 'inline-block';
  } else {
    img.removeAttribute('src');
    img.style.display = 'inline-block';
  }
}

// ✅ nunca chama /users/undefined
async function tryFetchMe(role, id) {
  if (!role || !id || id === 'undefined' || id === 'null') return null;

  try {
    const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function initMenuPerfil(options = {}) {
  const {
    loginRedirect = 'login.html',
    logoutRedirectProfessor = 'login-professor.html',
    logoutRedirectStudent = 'login-aluno.html',
  } = options;

  const menuBtn = $('menuBtn');
  const menuPanel = $('menuPanel');
  const closeBtn = $('menuCloseBtn');

  // se a página nem tem menu, sai
  if (!menuBtn || !menuPanel) return;

  // ✅ evita duplicar listeners (muito comum quando há 2 scripts)
  if (menuPanel.dataset.mkInit === '1') return;
  menuPanel.dataset.mkInit = '1';

  menuBtn.addEventListener('click', () => {
    menuPanel.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      menuPanel.classList.remove('open');
    });
  }

  const { role, id } = getRoleAndId();

  // visitante
  if (!role || !id) {
    safeText($('meName'), 'Visitante');
    safeText($('meEmail'), '');
    safeText($('meId'), '');
    safeText($('meRole'), '');
    loadPhoto(null, null);

    const logoutBtn = $('logoutMenuBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => (window.location.href = loginRedirect));

    const delBtn = $('deleteAccountBtn');
    if (delBtn) delBtn.addEventListener('
