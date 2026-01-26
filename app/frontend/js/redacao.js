import { API_URL } from './config.js';

// ELEMENTOS
const titleInput = document.getElementById('essayTitle');
const textarea = document.getElementById('essayText');
const charCount = document.getElementById('charCount');
const status = document.getElementById('status');

const saveBtn = document.getElementById('saveBtn');
const sendBtn = document.getElementById('sendBtn');

const taskTitleEl = document.getElementById('taskTitle');
const taskGuidelinesEl = document.getElementById('taskGuidelines');

// PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const studentId = localStorage.getItem('studentId');

if (!taskId || !studentId || studentId === 'undefined' || studentId === 'null') {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

if (!titleInput || !textarea || !charCount || !status || !sendBtn || !saveBtn) {
  console.error('HTML incompleto em redacao.html');
  throw new Error('Elementos não encontrados');
}

function setStatus(msg) {
  status.textContent = msg || '';
}

function setDisabledAll(disabled) {
  titleInput.disabled = disabled;
  textarea.disabled = disabled;
  saveBtn.disabled = disabled;
  sendBtn.disabled = disabled;
}

function updateCount() {
  charCount.textContent = String((textarea.value || '').length);
}

function draftKey() {
  return `mk_draft_${studentId}_${taskId}`;
}

function saveDraftLocal(title, content) {
  const payload = { title: title || '', content: content || '' };
  localStorage.setItem(draftKey(), JSON.stringify(payload));
}

function loadDraftLocal() {
  const raw = localStorage.getItem(draftKey());
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw);
    if (!obj) return null;
    return {
      title: String(obj.title || ''),
      content: String(obj.content || ''),
    };
  } catch {
    return null;
  }
}

// ✅ Empacota título + corpo no content (sem mexer no backend)
function packContent(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '');
  return `__TITLE__:${t}\n\n${b}`;
}

// BLOQUEAR COLAR
textarea.addEventListener('paste', (e) => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// CONTADOR + AUTOSAVE (leve)
let autosaveTimer = null;

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    const title = (titleInput.value || '').trim();
    const text = textarea.value || '';
    if (title || text.trim()) {
      saveDraftLocal(title, text);
    }
  }, 600);
}

// ✅ BLOQUEAR COLAR / ARRASTAR (inclui fallback p/ mobile)
function antiPaste(el, fieldName, options = {}) {
  if (!el) return;

  const maxJump = Number(options.maxJump ?? 25); // tolera digitação normal; cola costuma inserir muito
  let lastValue = el.value || '';
  let lastLen = lastValue.length;

  function warn() {
    alert(`Colar texto não é permitido em ${fieldName}. Digite no sistema.`);
  }

  // 1) Tentativas explícitas (desktop e alguns mobiles)
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    warn();
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    warn();
  });

  el.addEventListener('dragover', (e) => e.preventDefault());

  el.addEventListener('beforeinput', (e) => {
    const t = e.inputType;
    if (
      t === 'insertFromPaste' ||
      t === 'insertFromDrop' ||
      t === 'insertFromYank' ||          // alguns navegadores
      t === 'insertReplacementText'      // autocorreção/cola em certos casos (vai cair no fallback também)
    ) {
      e.preventDefault();
      warn();
    }
  });

  // 2) Fallback universal (funciona melhor no mobile):
  // Se entrar texto "grande" de uma vez, reverte.
  el.addEventListener('input', () => {
    const cur = el.value || '';
    const curLen = cur.length;

    const diff = curLen - lastLen;

    // Se aumentou muito de uma vez, é quase sempre cola
    if (diff > maxJump) {
      el.value = lastValue; // reverte
      // força cursor no final (evita comportamento estranho)
      try { el.setSelectionRange(lastLen, lastLen); } catch {}
      warn();
      return;
    }

    // atualiza histórico
    lastValue = cur;
    lastLen = curLen;
  });

  // Se o valor for preenchido programaticamente (rascunho carregado etc.)
  function sync() {
    lastValue = el.value || '';
    lastLen = lastValue.length;
  }

  return { sync };
}

// Ativa nos dois campos.
// Para título, um salto de 15 já é suficiente.
// Para redação, 25 é um bom equilíbrio (aceita digitação rápida/auto-sugestão sem travar).
const antiTitle = antiPaste(titleInput, 'Título', { maxJump: 15 });
const antiEssay = antiPaste(textarea, 'Redação', { maxJump: 25 });

titleInput.addEventListener('input', () => {
  scheduleAutosave();
});

textarea.addEventListener('input', () => {
  updateCount();
  scheduleAutosave();
});

// 🔹 CARREGAR TAREFA (TEMA + ORIENTAÇÕES)
async function carregarTarefa() {
  try {
    const response = await fetch(`${API_URL}/tasks/${encodeURIComponent(taskId)}`);
    if (!response.ok) throw new Error();

    const task = await response.json();
    taskTitleEl.textContent = task?.title || 'Tema da Redação';
    taskGuidelinesEl.textContent = task?.guidelines || 'Sem orientações adicionais.';
  } catch {
    taskTitleEl.textContent = 'Tema da Redação';
    taskGuidelinesEl.textContent = 'Não foi possível carregar as orientações.';
  }
}

// ✅ CARREGAR RASCUNHO LOCAL (SE EXISTIR)
function carregarRascunhoLocal() {
  const draft = loadDraftLocal();
  if (draft && (draft.title.trim() || draft.content.trim())) {
    titleInput.value = draft.title;
    textarea.value = draft.content;
    updateCount();
    setStatus('Rascunho carregado.');

    antiTitle?.sync?.();
    antiEssay?.sync?.();

  } else {
    updateCount();
  }
}

// ✅ SALVAR RASCUNHO (LOCALSTORAGE)
saveBtn.addEventListener('click', () => {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title && !text.trim()) {
    localStorage.removeItem(draftKey());
    setStatus('Nada para salvar. Rascunho removido.');
    return;
  }

  saveDraftLocal(title, text);
  setStatus('Rascunho salvo.');
});

// ✅ VERIFICAR SE JÁ ENVIOU (bloqueia reenvio)
async function checarJaEnviou() {
  try {
    const res = await fetch(`${API_URL}/essays/by-task/${encodeURIComponent(taskId)}`);
    if (!res.ok) return { sent: false };

    const list = await res.json();
    if (!Array.isArray(list)) return { sent: false };

    const mine = list.find((e) => e && String(e.studentId) === String(studentId));

    if (mine && mine.id) {
      return { sent: true, essayId: mine.id };
    }

    return { sent: false };
  } catch {
    return { sent: false };
  }
}

// ✅ ENVIAR REDAÇÃO (BACKEND)
sendBtn.addEventListener('click', async () => {
  const title = (titleInput.value || '').trim();
  const text = textarea.value || '';

  if (!title) {
    alert('Informe o título da redação.');
    return;
  }

  if (text.length < 500) {
    alert('A redação deve ter pelo menos 500 caracteres.');
    return;
  }

  // evita clique duplo
  sendBtn.disabled = true;

  // checa de novo antes de enviar (segurança)
  const ja = await checarJaEnviou();
  if (ja.sent) {
    setStatus('Você já enviou esta redação. Não é permitido reenviar.');
    setDisabledAll(true);
    window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`;
    return;
  }

  setStatus('Enviando redação...');

  try {
    const response = await fetch(`${API_URL}/essays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        studentId,
        content: packContent(title, text),
      }),
    });

    if (!response.ok) throw new Error();

    const essay = await response.json();

    // remove rascunho após envio bem sucedido
    localStorage.removeItem(draftKey());

    setDisabledAll(true);
    setStatus('Redação enviada com sucesso!');

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(essay.id)}`;
    }, 600);
  } catch {
    sendBtn.disabled = false;
    setStatus('Erro ao enviar redação.');
  }
});

// INIT
(async () => {
  await carregarTarefa();

  carregarRascunhoLocal();

  setStatus('Verificando envio...');
  const ja = await checarJaEnviou();

  if (ja.sent) {
    setStatus('Você já enviou esta redação. Redirecionando para o feedback...');
    setDisabledAll(true);

    setTimeout(() => {
      window.location.href = `feedback-aluno.html?essayId=${encodeURIComponent(ja.essayId)}`;
    }, 400);

    return;
  }

  setStatus('');
})();

