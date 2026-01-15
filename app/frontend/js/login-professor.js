import { API_URL } from './config.js';

const status = document.getElementById('status');

const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

const emailLoginEl = document.getElementById('emailLogin');
const passLoginEl = document.getElementById('passwordLogin');

const nameRegEl = document.getElementById('nameRegister');
const emailRegEl = document.getElementById('emailRegister');
const passRegEl = document.getElementById('passwordRegister');

// ✅ Se já estiver logado, vai direto
const professorId = localStorage.getItem('professorId');
if (professorId) {
  window.location.href = 'professor-salas.html';
}

// helper
function setStatus(msg) {
  status.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = value;
}

// ✅ LOGIN
loginBtn.addEventListener('click', async () => {
  const email = (emailLoginEl.value || '').trim();
  const password = passLoginEl.value || '';

  if (!email || !password) {
    setStatus('Preencha e-mail e senha.');
    return;
  }

  setStatus('Entrando...');
  disable(loginBtn, true);

  try {
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw new Error();

    const data = await response.json();

    // ✅ garante que é professor
    if (data.role && data.role !== 'professor') {
      setStatus('Este acesso é apenas para professores.');
      disable(loginBtn, false);
      return;
    }

    localStorage.setItem('professorId', data.id);
    window.location.href = 'professor-salas.html';

  } catch {
    setStatus('Erro ao fazer login. Verifique seus dados.');
    disable(loginBtn, false);
  }
});

// ✅ CADASTRO
registerBtn.addEventListener('click', async () => {
  const name = (nameRegEl.value || '').trim();
  const email = (emailRegEl.value || '').trim();
  const password = passRegEl.value || '';

  if (!name || !email || !password) {
    setStatus('Preencha nome, e-mail e senha.');
    return;
  }

  if (password.length < 8) {
    setStatus('A senha deve ter no mínimo 8 caracteres.');
    return;
  }

  setStatus('Cadastrando...');
  disable(registerBtn, true);

  try {
    const response = await fetch(`${API_URL}/users/professor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) throw new Error();

    // ✅ melhoria: login automático após cadastro
    const loginRes = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginRes.ok) {
      setStatus('Cadastro realizado. Agora faça login.');
      disable(registerBtn, false);
      return;
    }

    const data = await loginRes.json();
    localStorage.setItem('professorId', data.id);

    // limpa campos
    nameRegEl.value = '';
    emailRegEl.value = '';
    passRegEl.value = '';

    window.location.href = 'professor-salas.html';

  } catch {
    setStatus('Erro ao cadastrar professor. Tente outro e-mail.');
    disable(registerBtn, false);
  }
});
