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
