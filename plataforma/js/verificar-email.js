import { API_URL, apiFetch } from './config.js';

const params = new URLSearchParams(window.location.search);
const status = document.getElementById('status');

function showResult(ok, message) {
  status.textContent = message;
  status.dataset.result = ok ? 'success' : 'error';
  for (const id of ['goProfessor', 'goAluno', 'goEscola', 'goHome']) {
    const link = document.getElementById(id);
    if (link) link.hidden = false;
  }
}

async function verify() {
  // O backend também pode ter validado o token e redirecionado para esta página.
  if (params.get('ok') === '1') {
    showResult(true, 'E-mail confirmado. Entre com seu e-mail e senha para continuar.');
    return;
  }
  if (params.get('ok') === '0') {
    showResult(false, params.get('msg')?.slice(0, 200) || 'Não foi possível confirmar seu e-mail. Solicite um novo link no login.');
    return;
  }
  const token = params.get('token');
  if (!token) {
    showResult(false, 'Link de verificação ausente. Acesse o link recebido por e-mail ou solicite outro no login.');
    return;
  }
  try {
    const response = await apiFetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.message || 'Link inválido ou expirado. Solicite um novo link no login.');
    history.replaceState(null, '', `${window.location.pathname}?ok=1`);
    showResult(true, 'E-mail confirmado. Entre com seu e-mail e senha para continuar.');
  } catch (error) {
    showResult(false, error.message || 'Não foi possível confirmar seu e-mail.');
  }
}

verify();
