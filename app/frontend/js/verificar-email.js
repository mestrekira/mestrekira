function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const statusEl = document.getElementById('status');
const goProfessor = document.getElementById('goProfessor');
const goAluno = document.getElementById('goAluno');
const goEscola = document.getElementById('goEscola');
const goHome = document.getElementById('goHome');

function setStatus(message, type = 'info') {
  if (!statusEl) return;

  statusEl.textContent = message || '';

  statusEl.classList.remove(
    'auth-status--success',
    'auth-status--error',
    'auth-status--info',
  );

  if (type === 'success') {
    statusEl.classList.add('auth-status--success');
    return;
  }

  if (type === 'error') {
    statusEl.classList.add('auth-status--error');
    return;
  }

  statusEl.classList.add('auth-status--info');
}

function show(el, visible) {
  if (!el) return;
  el.hidden = !visible;
}

function decodeMsg(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return String(value).trim();
  }
}

function revealLinks() {
  show(goProfessor, true);
  show(goAluno, true);
  show(goEscola, true);
  show(goHome, true);
}

function init() {
  const ok = qs('ok');
  const msg = decodeMsg(qs('msg'));

  if (ok === '1') {
    setStatus(
      'E-mail verificado com sucesso. Agora você já pode fazer login na plataforma.',
      'success',
    );
    revealLinks();
    return;
  }

  if (ok === '0') {
    const suffix = msg ? ` Motivo: ${msg}` : '';
    setStatus(
      `Não foi possível verificar seu e-mail.${suffix}`,
      'error',
    );
    revealLinks();
    return;
  }

  setStatus(
    'Abra o link de verificação enviado para o seu e-mail para concluir esta etapa.',
    'info',
  );
  revealLinks();
}

init();
