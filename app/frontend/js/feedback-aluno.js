import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');
const studentId = localStorage.getItem('studentId');

if (!essayId || !studentId || studentId === 'undefined' || studentId === 'null') {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

// 🔹 ELEMENTOS
const taskTitleEl = document.getElementById('taskTitle');
const essayContentEl = document.getElementById('essayContent');
const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

function setText(el, value, fallback = '—') {
  if (!el) return;
  el.textContent = value === null || value === undefined || value === '' ? fallback : String(value);
}

// ✅ Lê o título do formato: "__TITLE__:Meu título\n\ncorpo..."
function unpackContent(raw) {
  const text = String(raw || '');

  const m = text.match(/^__TITLE__:(.*)\n\n([\s\S]*)$/);
  if (!m) return { title: '', body: text };

  return {
    title: String(m[1] || '').trim(),
    body: String(m[2] || ''),
  };
}

// ✅ aplica estilo de “caixa + justificado” e injeta o título centralizado dentro da própria caixa
function renderEssayFormatted(containerEl, packedContent) {
  if (!containerEl) return;

  const { title, body } = unpackContent(packedContent);

  // limpa
  containerEl.innerHTML = '';

  // garante aparência de "caixa"
  containerEl.style.whiteSpace = 'pre-wrap';
  containerEl.style.textAlign = 'justify';

  // título (centralizado, negrito)
  if (title) {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.textAlign = 'center';
    h.style.fontWeight = '700';
    h.style.marginBottom = '10px';
    containerEl.appendChild(h);
  }

  // corpo (justificado)
  const p = document.createElement('div');
  p.textContent = body || '';
  p.style.textAlign = 'justify';
  containerEl.appendChild(p);
}

// nomes das competências (ENEM)
const COMP_NAMES = {
  c1: 'Domínio da norma culta',
  c2: 'Compreensão do tema',
  c3: 'Seleção e organização de argumentos',
  c4: 'Coesão e coerência',
  c5: 'Proposta de intervenção',
};

// (opcional) se você quiser deixar ainda mais explícito sem mexer no HTML,
// eu ajusto o texto do <strong>Competência X:</strong> para incluir o nome.
function patchCompetencyLabels() {
  const map = [
    { id: 'c1', name: COMP_NAMES.c1 },
    { id: 'c2', name: COMP_NAMES.c2 },
    { id: 'c3', name: COMP_NAMES.c3 },
    { id: 'c4', name: COMP_NAMES.c4 },
    { id: 'c5', name: COMP_NAMES.c5 },
  ];

  map.forEach(({ id, name }) => {
    const span = document.getElementById(id);
    if (!span) return;

    // procura o <p> pai e o <strong> dentro dele
    const p = span.closest('p');
    if (!p) return;

    const strong = p.querySelector('strong');
    if (!strong) return;

    // Ex.: "Competência 1:" -> "Competência 1 (Domínio da norma culta):"
    const base = strong.textContent || '';
    if (base.includes('(')) return; // evita duplicar
    strong.textContent = base.replace(':', ` (${name}):`);
  });
}

// 🔹 CARREGAR FEEDBACK
async function carregarFeedback() {
  try {
    // 1) redação
    const resEssay = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}`);
    if (!resEssay.ok) throw new Error();

    const essay = await resEssay.json();

    // 🔐 checagem
    if (String(essay.studentId) !== String(studentId)) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'painel-aluno.html';
      return;
    }

    // 2) tema (task)
    setText(taskTitleEl, '—');
    if (essay.taskId) {
      try {
        const resTask = await fetch(`${API_URL}/tasks/${encodeURIComponent(essay.taskId)}`);
        if (resTask.ok) {
          const task = await resTask.json();
          setText(taskTitleEl, task?.title || '—');
        }
      } catch {
        // ignora
      }
    }

    // 3) redação formatada (título centralizado + corpo justificado)
    renderEssayFormatted(essayContentEl, essay.content || '');

    // 4) nota
    const hasScore = essay.score !== null && essay.score !== undefined;
    setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida');

    // 5) feedback (em caixa e justificado também)
    if (feedbackEl) {
      feedbackEl.textContent = essay.feedback || 'Aguardando correção do professor.';
      feedbackEl.style.whiteSpace = 'pre-wrap';
      feedbackEl.style.textAlign = 'justify';
    }

    // 6) competências
    if (c1El) setText(c1El, essay.c1 ?? '—');
    if (c2El) setText(c2El, essay.c2 ?? '—');
    if (c3El) setText(c3El, essay.c3 ?? '—');
    if (c4El) setText(c4El, essay.c4 ?? '—');
    if (c5El) setText(c5El, essay.c5 ?? '—');

    // 7) inclui nome das competências no label (sem mexer no HTML)
    patchCompetencyLabels();
  } catch {
    alert('Erro ao carregar feedback.');
    window.location.href = 'painel-aluno.html';
  }
}

// 🔹 VOLTAR
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'painel-aluno.html';
  });
}

carregarFeedback();
