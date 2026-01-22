import { API_URL } from './config.js';

const status = document.getElementById('status');
const enterBtn = document.getElementById('enterBtn');

const codeEl = document.getElementById('code');
const nameEl = document.getElementById('name');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');

function validId(v) {
  return v && v !== 'undefined' && v !== 'null';
}

function setStatus(msg) {
  if (status) status.textContent = msg || '';
}

function setBusy(busy) {
  if (enterBtn) enterBtn.disabled = !!busy;
  [codeEl, nameEl, emailEl, passEl].forEach((el) => {
    if (el) el.disabled = !!busy;
  });
}

async function ensureStudentLoggedIn() {
  // se já tem studentId, ok
  const studentId = localStorage.getItem('studentId');
  if (validId(studentId)) return studentId;

  // primeiro acesso: precisa criar + logar
  const name = (nameEl?.value || '').trim();
  const email = (emailEl?.value || '').trim();
  const password = passEl?.value || '';

  if (!name || !email || !password) {
    throw new Error('missing_fields');
  }
  if (password.length < 8) {
    throw new Error('weak_password');
  }

  // cria aluno
  const createRes = await fetch(`${API_URL}/users/student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!createRes.ok) {
    throw new Error('create_failed');
  }

  // login para obter id
  const loginRes = await fetch(`${API_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await loginRes.json().catch(() => null);

  if (!loginRes.ok || !data || data.error || !data.id) {
    throw new Error('login_failed');
  }

  // garante papel aluno
  const role = String(data.role || '').trim().toUpperCase();
  if (role === 'PROFESSOR') {
    throw new Error('not_student');
  }

  // limpa outros papéis (evita conflito)
  localStorage.removeItem('professorId');
  localStorage.setItem('studentId', data.id);

  // opcional
  if (data.name) localStorage.setItem('studentName', data.name);
  if (data.email) localStorage.setItem('studentEmail', data.email);

  return data.id;
}

async function entrar() {
  const code = (codeEl?.value || '').trim().toUpperCase();
  if (!code) {
    setStatus('Informe o código da sala.');
    return;
  }

  setBusy(true);
  setStatus('Processando...');

  try {
    const studentId = await ensureStudentLoggedIn();

    setStatus('Entrando na sala...');

    const response = await fetch(`${API_URL}/enrollments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, studentId }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.roomId) throw new Error('join_failed');

    window.location.href = `sala-aluno.html?roomId=${encodeURIComponent(data.roomId)}`;
  } catch (e) {
    const msg = String(e?.message || '');

    if (msg === 'missing_fields') setStatus('Primeiro acesso: preencha nome, e-mail e senha.');
    else if (msg === 'weak_password') setStatus('A senha deve ter no mínimo 8 caracteres.');
    else if (msg === 'create_failed') setStatus('Erro ao criar conta. Tente outro e-mail.');
    else if (msg === 'login_failed') setStatus('Conta criada, mas falhou o login. Tente entrar pelo login.');
    else if (msg === 'not_student') setStatus('Este e-mail é de professor. Use o acesso de professor.');
    else setStatus('Erro ao entrar na sala. Verifique o código.');
    setBusy(false);
  }
}

if (enterBtn) enterBtn.addEventListener('click', entrar);
if (codeEl) {
  codeEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrar();
  });
}
