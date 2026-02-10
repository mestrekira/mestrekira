function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const statusEl = document.getElementById('status');
const goProfessor = document.getElementById('goProfessor');
const goAluno = document.getElementById('goAluno');
const goHome = document.getElementById('goHome');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function show(el, on) {
  if (!el) return;
  el.style.display = on ? 'inline-block' : 'none';
}

const ok = qs('ok'); // "1" ou "0"
const msg = qs('msg');

if (ok === '1') {
  setStatus('✅ E-mail verificado com sucesso! Agora você já pode fazer login.');

  // Mostra links (você pode ajustar para mostrar só o necessário)
  show(goProfessor, true);
  show(goAluno, true);
  show(goHome, true);
} else if (ok === '0') {
  setStatus(
    `❌ Não foi possível verificar seu e-mail. ${
      msg ? `Motivo: ${decodeURIComponent(msg)}` : ''
    }`,
  );

  show(goProfessor, true);
  show(goAluno, true);
  show(goHome, true);
} else {
  // caso alguém acesse direto a página
  setStatus('Abra o link de verificação enviado para o seu e-mail.');
  show(goProfessor, true);
  show(goAluno, true);
  show(goHome, true);
}
