import { API_URL } from './config.js';
import { notify, clearAuth } from './auth.js';
import { readErrorMessage } from './auth.js';

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const el = $('status');
  if (el) el.textContent = msg || '';
}

function normalizeEmail(s) {
  return String(s || '').trim().toLowerCase();
}

function normalizeCode(s) {
  return String(s || '').trim().toUpperCase();
}

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const msg = await readErrorMessage(res, 'Erro na requisição.');
    throw new Error(msg);
  }

  return res.json();
}

function saveSession(data) {
  // esperado: { ok, token, user }
  const token = data?.token || '';
  const user = data?.user || null;

  if (!token || !user?.id) throw new Error('Resposta inválida do servidor.');

  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));

  // compat com telas antigas
  localStorage.setItem('professorId', String(user.id));
  localStorage.removeItem('studentId');
}

function goAfterVerify(user) {
  // se mustChangePassword, obriga trocar
  if (user?.mustChangePassword) {
    window.location.replace('professor-atualizar-senha.html');
    return;
  }
  // caso já esteja ok
  window.location.replace('painel-professor.html');
}

(async function init() {
  // limpa qualquer sessão anterior para evitar confusão
  clearAuth();

  const btnSend = $('btnSend');
  const btnVerify = $('btnVerify');

  btnSend?.addEventListener('click', async () => {
    const email = normalizeEmail($('email')?.value);
    if (!email || !email.includes('@')) {
      notify('warn', 'E-mail inválido', 'Informe um e-mail válido.');
      return;
    }

    setStatus('Enviando código...');
    btnSend.disabled = true;

    try {
      const data = await postJson('/school-teacher/send-code', { email });
      setStatus(data?.message || 'Se o e-mail existir, enviaremos um código.');

      // DEV: se backend devolver code, mostramos um toast (ajuda teste)
      if (data?.code) {
        notify('info', 'Código (DEV)', `Seu código: ${data.code}`, 6000);
        const codeInput = $('code');
        if (codeInput) codeInput.value = String(data.code);
      } else {
        notify('success', 'Pronto', 'Se o e-mail existir, enviaremos um código.');
      }
    } catch (e) {
      const msg = String(e?.message || 'Erro ao enviar código.');
      setStatus('');
      notify('error', 'Erro', msg);
    } finally {
      btnSend.disabled = false;
    }
  });

  btnVerify?.addEventListener('click', async () => {
    const email = normalizeEmail($('email')?.value);
    const code = normalizeCode($('code')?.value);

    if (!email || !email.includes('@')) {
      notify('warn', 'E-mail inválido', 'Informe um e-mail válido.');
      return;
    }
    if (!code) {
      notify('warn', 'Código ausente', 'Informe o código recebido.');
      return;
    }

    setStatus('Verificando código...');
    btnVerify.disabled = true;

    try {
      const data = await postJson('/school-teacher/verify-code', { email, code });

      if (!data?.ok) {
        throw new Error(data?.error || 'Não foi possível verificar o código.');
      }

      saveSession(data);
      notify('success', 'Bem-vindo', 'Acesso liberado.');
      goAfterVerify(data.user);
    } catch (e) {
      const msg = String(e?.message || 'Código inválido/expirado.');
      setStatus('');
      notify('error', 'Falha', msg);
    } finally {
      btnVerify.disabled = false;
    }
  });
})();
