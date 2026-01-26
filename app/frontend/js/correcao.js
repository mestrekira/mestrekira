import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const focusStudentId = params.get('studentId'); // ✅ opcional: abrir direto um aluno

if (!taskId) {
  alert('Tarefa inválida.');
  throw new Error('taskId ausente');
}

// 🔹 ELEMENTOS
const essaysList = document.getElementById('essaysList');
const correctionSection = document.getElementById('correctionSection');
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');
const essayContentEl = document.getElementById('essayContent');

const studentPhotoImg = document.getElementById('studentPhotoImg');

const feedbackEl = document.getElementById('feedback');
const saveBtn = document.getElementById('saveCorrectionBtn');
const statusEl = document.getElementById('status');

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');
const totalScoreEl = document.getElementById('totalScore');

let currentEssayId = null;

function photoKeyStudent(studentId) {
  return `mk_photo_student_${studentId}`;
}

function placeholderAvatarDataUrl(letter = '?') {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">${letter}</text>
      </svg>`
    )
  );
}

function setStudentPhoto(studentId) {
  if (!studentPhotoImg) return;

  const dataUrl = studentId ? localStorage.getItem(photoKeyStudent(studentId)) : null;

  if (dataUrl) {
    studentPhotoImg.src = dataUrl;
    studentPhotoImg.style.display = 'inline-block';
  } else {
    studentPhotoImg.removeAttribute('src');
    studentPhotoImg.style.display = 'none';
  }
}

function clamp200(n) {
  if (Number.isNaN(n)) return null;
  if (n < 0) return 0;
  if (n > 200) return 200;
  return n;
}

function calcularTotal() {
  const v1 = clamp200(Number(c1El.value));
  const v2 = clamp200(Number(c2El.value));
  const v3 = clamp200(Number(c3El.value));
  const v4 = clamp200(Number(c4El.value));
  const v5 = clamp200(Number(c5El.value));

  if ([v1, v2, v3, v4, v5].some((v) => v === null)) {
    totalScoreEl.textContent = '—';
    return null;
  }

  const total = v1 + v2 + v3 + v4 + v5;
  totalScoreEl.textContent = String(total);
  return { v1, v2, v3, v4, v5, total };
}

// ✅ RUBRICAS ENEM (0–200 de 40 em 40) — base INEP/Cartilha
const ENEM_RUBRICS = {
  c1: {
    title: 'Competência 1 — Domínio da modalidade escrita formal',
    levels: [
      { score: 200, text: 'Excelente domínio da modalidade formal; desvios raros e não reincidentes.' },
      { score: 160, text: 'Bom domínio; poucos desvios gramaticais e de convenções.' },
      { score: 120, text: 'Domínio mediano; alguns desvios gramaticais e de convenções.' },
      { score: 80,  text: 'Domínio insuficiente; muitos desvios, inclusive de registro e convenções.' },
      { score: 40,  text: 'Domínio precário e sistemático; desvios frequentes e diversificados.' },
      { score: 0,   text: 'Desconhecimento da modalidade escrita formal.' },
    ],
  },
  c2: {
    title: 'Competência 2 — Compreender o tema e o tipo dissertativo-argumentativo',
    levels: [
      { score: 200, text: 'Argumentação consistente com repertório produtivo; excelente domínio do texto dissertativo-argumentativo.' },
      { score: 160, text: 'Argumentação consistente; bom domínio (proposição, argumentação e conclusão).' },
      { score: 120, text: 'Argumentação previsível; domínio mediano (proposição, argumentação e conclusão).' },
      { score: 80,  text: 'Cópia de trechos motivadores ou domínio insuficiente; estrutura não plenamente atendida.' },
      { score: 40,  text: 'Tangencia o tema ou domínio precário; traços constantes de outros tipos textuais.' },
      { score: 0,   text: 'Fuga ao tema e/ou não atendimento ao tipo dissertativo-argumentativo.' },
    ],
  },
  c3: {
    title: 'Competência 3 — Selecionar/organizar argumentos em defesa do ponto de vista',
    levels: [
      { score: 200, text: 'Informações/fatos/opiniões consistentes e organizados; autoria clara; defende ponto de vista.' },
      { score: 160, text: 'Organizado, com indícios de autoria; defende ponto de vista.' },
      { score: 120, text: 'Limitado aos textos motivadores e pouco organizado; ainda defende ponto de vista.' },
      { score: 80,  text: 'Desorganizado/contraditório e limitado aos motivadores; defende ponto de vista.' },
      { score: 40,  text: 'Pouco relacionado ao tema ou incoerente; sem defesa de ponto de vista.' },
      { score: 0,   text: 'Não relacionado ao tema; sem defesa de ponto de vista.' },
    ],
  },
  c4: {
    title: 'Competência 4 — Coesão e mecanismos linguísticos de articulação',
    levels: [
      { score: 200, text: 'Articula muito bem as partes; repertório diversificado de recursos coesivos.' },
      { score: 160, text: 'Articula bem, com poucas inadequações; repertório diversificado.' },
      { score: 120, text: 'Articulação mediana, com inadequações; repertório pouco diversificado.' },
      { score: 80,  text: 'Articulação insuficiente, muitas inadequações; repertório limitado.' },
      { score: 40,  text: 'Articula de forma precária.' },
      { score: 0,   text: 'Não articula as informações.' },
    ],
  },
  c5: {
    title: 'Competência 5 — Proposta de intervenção (direitos humanos)',
    levels: [
      { score: 200, text: 'Proposta muito bem elaborada, detalhada, relacionada ao tema e articulada à discussão.' },
      { score: 160, text: 'Proposta bem elaborada, relacionada ao tema e articulada à discussão.' },
      { score: 120, text: 'Proposta mediana, relacionada ao tema e articulada à discussão.' },
      { score: 80,  text: 'Proposta insuficiente; relacionada ao tema, ou não articulada à discussão.' },
      { score: 40,  text: 'Proposta vaga/precária ou apenas relacionada ao assunto.' },
      { score: 0,   text: 'Não apresenta proposta ou propõe algo não relacionado ao tema/assunto.' },
    ],
  },
};

function snapToNearestEnemLevel(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const clamped = Math.max(0, Math.min(200, n));
  // ENEM: 0, 40, 80, 120, 160, 200
  const levels = [0, 40, 80, 120, 160, 200];
  let best = levels[0];
  let bestDist = Math.abs(clamped - best);
  for (const lv of levels) {
    const d = Math.abs(clamped - lv);
    if (d < bestDist) { best = lv; bestDist = d; }
  }
  return best;
}

function renderRubric(compKey) {
  const panel = document.getElementById(`rubric-${compKey}`);
  if (!panel) return;

  const rubric = ENEM_RUBRICS[compKey];
  if (!rubric) return;

  panel.innerHTML = '';

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';
  title.textContent = rubric.title;
  panel.appendChild(title);

  const table = document.createElement('table');
  table.className = 'rubric-table';

  rubric.levels.forEach((lv) => {
    const tr = document.createElement('tr');
    tr.dataset.score = String(lv.score);

    const tdScore = document.createElement('td');
    tdScore.className = 'rubric-level';
    tdScore.textContent = String(lv.score);

    const tdText = document.createElement('td');
    tdText.textContent = lv.text;

    tr.appendChild(tdScore);
    tr.appendChild(tdText);
    table.appendChild(tr);
  });

  panel.appendChild(table);
}

function setRubricActiveRow(compKey, score) {
  const panel = document.getElementById(`rubric-${compKey}`);
  if (!panel) return;
  const rows = panel.querySelectorAll('tr[data-score]');
  rows.forEach((r) => r.classList.remove('rubric-active'));
  const target = panel.querySelector(`tr[data-score="${score}"]`);
  if (target) target.classList.add('rubric-active');
}

function updateRubricHint(compKey, rawValue) {
  const hint = document.getElementById(`hint-${compKey}`);
  if (!hint) return;

  const snapped = snapToNearestEnemLevel(rawValue);
  if (snapped === null) {
    hint.textContent = '';
    return;
  }

  const rubric = ENEM_RUBRICS[compKey];
  const levelObj = rubric?.levels?.find((x) => x.score === snapped);

  hint.innerHTML = `<strong>Nível sugerido:</strong> ${snapped} — ${levelObj ? levelObj.text : ''}`;
  setRubricActiveRow(compKey, snapped);
}

function initRubricsUI() {
  // Renderiza todas as tabelas uma vez
  ['c1','c2','c3','c4','c5'].forEach((k) => renderRubric(k));

  // Toggle abrir/fechar
  document.querySelectorAll('.rubric-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const compKey = btn.getAttribute('data-comp');
      const panel = document.getElementById(`rubric-${compKey}`);
      if (!panel) return;

      const willOpen = panel.hidden === true;
      panel.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });

  // Atualiza “nível sugerido” ao digitar
  const map = {
    c1: c1El, c2: c2El, c3: c3El, c4: c4El, c5: c5El,
  };

  Object.entries(map).forEach(([k, input]) => {
    if (!input) return;
    input.addEventListener('input', () => updateRubricHint(k, input.value));
  });
}

// recálculo ao digitar
[c1El, c2El, c3El, c4El, c5El].forEach((el) => {
  el.addEventListener('input', () => calcularTotal());
});

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

/**
 * ✅ Remove o marcador e separa título/corpo.
 * Aceita:
 *  - "__TITLE__:Meu título\n\ncorpo..."
 *  - "_TITLE_:Meu título\n\ncorpo..."
 *  - "TITLE:Meu título\n\ncorpo..."
 * Caso não encontre, usa "primeira linha" como título (fallback).
 */
function splitTitleAndBody(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  // 1) padrão com marcador (variações)
  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim(),
      body: String(m[2] || '').trimEnd(),
    };
  }

  // 2) fallback: primeira linha não vazia = título
  const lines = text.split('\n');

  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '—', body: '' };

  const title = String(lines[firstIdx] || '').trim();
  const bodyLines = lines.slice(firstIdx + 1);

  while (bodyLines.length && !String(bodyLines[0] || '').trim()) bodyLines.shift();

  const body = bodyLines.join('\n').trimEnd();
  return { title: title || '—', body };
}

/**
 * ✅ Renderiza a redação para o professor (título limpo e bonito).
 */
function renderEssayForProfessor(containerEl, packedContent) {
  if (!containerEl) return;

  const { title, body } = splitTitleAndBody(packedContent);

  containerEl.innerHTML = '';
  containerEl.style.whiteSpace = 'pre-wrap';
  containerEl.style.textAlign = 'justify';

  if (title && title !== '—') {
    const h = document.createElement('div');
    h.textContent = title; // ✅ sem _TITLE_
    h.style.textAlign = 'center';
    h.style.fontWeight = '700';
    h.style.marginBottom = '10px';
    containerEl.appendChild(h);
  }

  const b = document.createElement('div');
  b.textContent = body || '';
  b.style.textAlign = 'justify';
  containerEl.appendChild(b);
}

// 🔹 ABRIR REDAÇÃO
function abrirCorrecao(essay) {
  currentEssayId = essay.id;

  const nome =
    essay.studentName && essay.studentName.trim()
      ? essay.studentName
      : 'Aluno não identificado';

  studentNameEl.textContent = nome;

  studentEmailEl.textContent =
    essay.studentEmail && essay.studentEmail.trim()
      ? essay.studentEmail
      : '(e-mail indisponível)';

  setStudentPhoto(essay.studentId);

  // ✅ redação formatada (título sem marcador + corpo justificado)
  renderEssayForProfessor(essayContentEl, essay.content || '');

  feedbackEl.value = essay.feedback || '';

  // preenche competências se já existirem
  c1El.value = essay.c1 ?? '';
  c2El.value = essay.c2 ?? '';
  c3El.value = essay.c3 ?? '';
  c4El.value = essay.c4 ?? '';
  c5El.value = essay.c5 ?? '';

  calcularTotal();

    // ✅ Atualiza as sugestões/realces ao abrir uma redação já corrigida
  updateRubricHint('c1', c1El.value);
  updateRubricHint('c2', c2El.value);
  updateRubricHint('c3', c3El.value);
  updateRubricHint('c4', c4El.value);
  updateRubricHint('c5', c5El.value);

  correctionSection.style.display = 'block';
  setStatus('');
}

// 🔹 CARREGAR REDAÇÕES DA TAREFA
async function carregarRedacoes() {
  try {
    const response = await fetch(
      `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/with-student`
    );
    if (!response.ok) throw new Error();

    const essays = await response.json();
    essaysList.innerHTML = '';

    if (!Array.isArray(essays) || essays.length === 0) {
      essaysList.innerHTML = '<li>Nenhuma redação enviada ainda.</li>';
      return;
    }

    // ✅ se veio studentId pela URL, abre automaticamente o primeiro match
    if (focusStudentId) {
      const target = essays.find((e) => String(e.studentId) === String(focusStudentId));
      if (target) abrirCorrecao(target);
    }

    essays.forEach((essay) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '12px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';

      // ✅ avatar do aluno
      const avatar = document.createElement('img');
      avatar.width = 36;
      avatar.height = 36;
      avatar.style.borderRadius = '50%';
      avatar.style.objectFit = 'cover';
      avatar.style.border = '1px solid #ccc';

      const nome =
        essay.studentName && essay.studentName.trim() ? essay.studentName : 'Aluno';

      const dataUrl = localStorage.getItem(photoKeyStudent(essay.studentId));
      avatar.src =
        dataUrl || placeholderAvatarDataUrl((nome || 'A').trim().slice(0, 1).toUpperCase());

      const text = document.createElement('div');
      const statusNota =
        essay.score !== null && essay.score !== undefined
          ? `Nota: ${essay.score}`
          : 'Sem correção';

      text.innerHTML = `<strong>${nome}</strong><br><small>${statusNota}</small>`;

      const btn = document.createElement('button');
      btn.textContent = 'Corrigir';
      btn.onclick = () => abrirCorrecao(essay);

      left.appendChild(avatar);
      left.appendChild(text);

      li.appendChild(left);
      li.appendChild(btn);

      essaysList.appendChild(li);
    });
  } catch {
    essaysList.innerHTML = '<li>Erro ao carregar redações.</li>';
  }
}

// 🔹 SALVAR CORREÇÃO
saveBtn.addEventListener('click', async () => {
  if (!currentEssayId) {
    setStatus('Selecione uma redação primeiro.');
    return;
  }

  const feedback = (feedbackEl.value || '').trim();
  const totalObj = calcularTotal();

  if (!feedback) {
    setStatus('Escreva o feedback.');
    return;
  }

  if (!totalObj) {
    setStatus('Preencha todas as competências (0 a 200).');
    return;
  }

  setStatus('Salvando correção...');

  try {
    const response = await fetch(`${API_URL}/essays/${encodeURIComponent(currentEssayId)}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedback,
        c1: totalObj.v1,
        c2: totalObj.v2,
        c3: totalObj.v3,
        c4: totalObj.v4,
        c5: totalObj.v5,
      }),
    });

    if (!response.ok) throw new Error();

    setStatus('Correção salva com sucesso!');
    carregarRedacoes();
  } catch {
    setStatus('Erro ao salvar correção.');
  }
});

// INIT
carregarRedacoes();
initRubricsUI();

