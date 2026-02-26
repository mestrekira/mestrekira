import { API_URL } from './config.js';

const $ = (id) => document.getElementById(id);

const newPassEl = $('newPassword');
const btn = $('btnSave');
const statusEl = $('status');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

async function save() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  const newPassword = String(newPassEl?.value || '');

  if (!token || !userId) {
    setStatus('Sessão inválida. Faça login novamente.');
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    setStatus('Senha deve ter no mínimo 8 caracteres.');
    return;
  }

  btn.disabled = true;
  setStatus('Salvando...');

  try {
    // ✅ usa endpoint existente: PATCH /users/:id { password }
    const r = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await r.json();

    if (!r.ok) {
      setStatus(data?.message || 'Erro ao salvar.');
      btn.disabled = false;
      return;
    }

    setStatus('Senha atualizada. Redirecionando...');
    // volta para login professor (ou professor-salas)
    window.location.href = 'professor-salas.html';
  } catch (e) {
    setStatus('Erro ao conectar.');
    btn.disabled = false;
  }
}

btn?.addEventListener('click', save);
