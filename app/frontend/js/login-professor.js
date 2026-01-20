import { API_URL } from './config.js';

const status = document.getElementById('status');

const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

const emailLoginEl = document.getElementById('emailLogin');
const passLoginEl = document.getElementById('passwordLogin');

const nameRegEl = document.getElementById('nameRegister');
const emailRegEl = document.getElementById('emailRegister');
const passRegEl = document.getElementById('passwordRegister');

// ✅ Se já estiver logado (e o valor for válido), vai direto
const professorId = localStorage.getItem('professorId');
if (professorId && professorId !== 'undefined' && professorId !== 'null') {
  window.location.replace('professor-salas.html');
}

// helper
function setStatus(msg) {
  if (status) status.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase(); // PROFESSSOR / STUDENT
}

// ✅ LOGIN
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const email = (emailLoginEl?.value || '').trim();
    const password = passLoginEl?.value || '';

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

      const data = await response.json().catch(() => null);

      // se backend retornar erro em JSON, mostra mensagem amigável
      if (!response.ok || !data?.id) {
        setStatus(data?.error || 'Login inválido.');
        disable(loginBtn, false);
        return;
      }

      const role = normalizeRole(data.role);

      // ✅ garante que é professor
      if (role !== 'PROFESSOR') {
        setStatus('Este acesso é apenas para professores.');
        disable(loginBtn, false);
        return;
      }

      // ✅ limpa possíveis restos de login de aluno
      localStorage.removeItem('studentId');

      localStorage.setItem('professorId', data.id);
      window.location.replace('professor-salas.html');

    } catch {
      setStatus('Erro ao fazer login. Verifique seus dados.');
      disable(loginBtn, false);
    }
  });
}

// ✅ CADASTRO
if (registerBtn) {
  registerBtn.addEventListener('click', async () => {
    const name = (nameRegEl?.value || '').trim();
    const email = (emailRegEl?.value || '').trim();
    const password = passRegEl?.value || '';

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

      if (!response.ok) {
        // tenta ler mensagem do backend
        const data = await response.json().catch(() => null);
        setStatus(data?.message || 'Erro ao cadastrar professor. Tente outro e-mail.');
        disable(registerBtn, false);
        return;
      }

      // ✅ login automático após cadastro
      const loginRes = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json().catch(() => null);

      if (!loginRes.ok || !loginData?.id) {
        setStatus('Cadastro realizado. Agora faça login.');
        disable(registerBtn, false);
        return;
      }

      const role = normalizeRole(loginData.role);
      if (role !== 'PROFESSOR') {
        setStatus('Cadastro realizado, mas o login não retornou professor. Faça login manualmente.');
        disable(registerBtn, false);
        return;
      }

      localStorage.removeItem('studentId');
      localStorage.setItem('professorId', loginData.id);

      // limpa campos
      if (nameRegEl) nameRegEl.value = '';
      if (emailRegEl) emailRegEl.value = '';
      if (passRegEl) passRegEl.value = '';

      window.location.replace('professor-salas.html');

    } catch {
      setStatus('Erro ao cadastrar professor. Tente outro e-mail.');
      disable(registerBtn, false);
    }
  });
}
