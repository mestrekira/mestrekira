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
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

// ✅ Desempacota título + corpo (MESMA lógica do redacao.js)
function unpackContent(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  // padrão novo: __TITLE__:...
  const re = /^__TITLE__\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim(),
      body: String(m[2] || ''),
    };
  }

  // fallback: sem marcador
  return { title: '', body: text };
}

// ✅ remove lixo comum que pode ter ficado salvo em versões antigas
function cleanLeadingGarbage(str) {
  let s = String(str || '').replace(/\r\n/g, '\n');

  // remove linhas iniciais vazias
  s = s.replace(/^\s+/, '');

  // remove _TITLE_ (e variações) se for a primeira linha
  s = s.replace(/^_+title_+\s*\n+/i, '');
  s = s.replace(/^_+t[ií]tulo_+\s*\n+/i, '');

  // remove "TITLE" / "TÍTULO" solto como primeira linha
  s = s.replace(/^(title|t[ií]tulo)\s*\n+/i, '');

  return s;
}

// ✅ aplica estilo: caixa + título centralizado + corpo justificado (preserva quebras)
function renderEssayFormatted(containerEl, rawContent) {
  if (!containerEl) return;

  // 1) desempacota
  const unpacked = unpackContent(rawContent);
  let title = (unpacked.title || '').trim();
  let body = unpacked.body || '';

  // 2) limpa lixo antigo (caso exista)
  title = cleanLeadingGarbage(title).trim();
  body = cleanLeadingGarbage(body);

  // 3) se título estiver vazio ou ainda for lixo, não mostra
  const badTitle =
    !title ||
    /^_+title_+$/i.test(title) ||
    /^_+t[ií]tulo_+$/i.test(title) ||
    /^title$/i.test(title) ||
    /^t[ií]tulo$/i.test(title);

  if (badTitle) title = '—';

  // 4) render
  containerEl.innerHTML = '';
  containerEl.style.whiteSpace = 'pre-wrap';
  containerEl.style.textAlign = 'justify';
  containerEl.style.lineHeight = '1.6';

  const h = document.createElement('div');
  h.textContent = title;
  h.style.textAlign = 'center';
  h.style.fontWeight = '700';
  h.style.marginBottom = '10px';
  containerEl.appendChild(h);

  const b = document.createElement('div');
  b.textContent = String(body || '').trimEnd();
  b.style.textAlign = 'justify';
  containerEl.appendChild(b);
}



// ✅ aplica estilo: caixa + título centralizado + corpo justificado (preserva quebras)
function renderEssayFormatted(containerEl, rawContent) {
  if (!containerEl) return;

  const { title, body } = splitTitleAndBody(rawContent);

  containerEl.innerHTML = '';

  // como o elemento já tem class="box", só ajusta comportamento do texto
  containerEl.style.whiteSpace = 'pre-wrap';
  containerEl.style.textAlign = 'justify';
  containerEl.style.lineHeight = '1.6';

  // título
  const h = document.createElement('div');
  h.textContent = title;
  h.style.textAlign = 'center';
  h.style.fontWeight = '700';
  h.style.marginBottom = '10px';
  containerEl.appendChild(h);

  // corpo
  const b = document.createElement('div');
  b.textContent = body || '';
  b.style.textAlign = 'justify';
  containerEl.appendChild(b);
}

// nomes das competências (ENEM)
const COMP_NAMES = {
  c1: 'Domínio da norma culta',
  c2: 'Compreensão do tema e repertório',
  c3: 'Argumentação e projeto de texto',
  c4: 'Coesão e mecanismos linguísticos',
  c5: 'Proposta de intervenção',
};

// ✅ ajusta os <strong> do HTML para incluir o nome da competência
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

    const p = span.closest('p');
    if (!p) return;

    const strong = p.querySelector('strong');
    if (!strong) return;

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

    // 3) redação formatada
    renderEssayFormatted(essayContentEl, essay.content || '');

    // 4) nota
    const hasScore = essay.score !== null && essay.score !== undefined;
    setText(scoreEl, hasScore ? String(essay.score) : 'Ainda não corrigida');

    // 5) feedback (caixa + justificado)
    if (feedbackEl) {
      feedbackEl.textContent = essay.feedback || 'Aguardando correção do professor.';
      feedbackEl.style.whiteSpace = 'pre-wrap';
      feedbackEl.style.textAlign = 'justify';
      feedbackEl.style.lineHeight = '1.6';
    }

    // 6) competências
    if (c1El) setText(c1El, essay.c1 ?? '—');
    if (c2El) setText(c2El, essay.c2 ?? '—');
    if (c3El) setText(c3El, essay.c3 ?? '—');
    if (c4El) setText(c4El, essay.c4 ?? '—');
    if (c5El) setText(c5El, essay.c5 ?? '—');

    // 7) nomes das competências no label
    patchCompetencyLabels();
  } catch (err) {
    console.error(err);
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


