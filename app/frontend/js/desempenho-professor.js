import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');

if (!roomId) {
  alert('Sala inválida.');
  window.location.href = 'professor-salas.html';
  throw new Error('roomId ausente');
}

const roomNameEl = document.getElementById('roomName');
const statusEl = document.getElementById('status');

const avgTotal = document.getElementById('avgTotal');
const avgC1 = document.getElementById('avgC1');
const avgC2 = document.getElementById('avgC2');
const avgC3 = document.getElementById('avgC3');
const avgC4 = document.getElementById('avgC4');
const avgC5 = document.getElementById('avgC5');

const studentsList = document.getElementById('studentsList');

function mean(nums) {
  const v = nums
    .map((n) => (n === null || n === undefined ? null : Number(n)))
    .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

// =====================
// Fotos (localStorage)
// =====================
function studentPhotoKey(studentId) {
  return studentId ? `mk_photo_student_${studentId}` : null;
}
function getStudentPhotoDataUrl(studentId) {
  const key = studentPhotoKey(studentId);
  return key ? localStorage.getItem(key) : null;
}
function makeAvatar(studentId, size = 34) {
  const img = document.createElement('img');
  img.alt = 'Foto do aluno';
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.border = '1px solid #ccc';
  img.style.display = 'none';

  const dataUrl = getStudentPhotoDataUrl(studentId);
  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = 'inline-block';
  }

  return img;
}

// =====================
// Fetch auxiliares
// =====================
async function carregarSala() {
  if (!roomNameEl) return;
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) throw new Error();
    const room = await res.json();
    roomNameEl.textContent = room?.name || 'Sala';
  } catch {
    roomNameEl.textContent = 'Sala';
  }
}

// ✅ pega alunos ATIVOS/matriculados
async function getActiveStudentsSet() {
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/students`);
    if (!res.ok) throw new Error();

    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];

    // aceita variações: id ou studentId
    const ids = arr
      .map((s) => String(s?.id || s?.studentId || '').trim())
      .filter(Boolean);

    return new Set(ids);
  } catch {
    // se falhar, retorna null e não filtra
    return null;
  }
}

// =====================
// UI: painel inline
// =====================
function closeAllInlinePanels() {
  if (!studentsList) return;
  const panels = studentsList.querySelectorAll('.mk-inline-panel');
  panels.forEach((p) => (p.style.display = 'none'));
}

function buildInlinePanel() {
  const wrap = document.createElement('div');
  wrap.className = 'mk-inline-panel';
  wrap.style.display = 'none';
  wrap.style.marginTop = '10px';
  wrap.style.padding = '10px';
  wrap.style.border = '1px solid #ddd';
  wrap.style.borderRadius = '10px';
  wrap.style.background = '#fff';

  // cabeçalho aluno
  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  head.style.gap = '10px';

  const photo = document.createElement('img');
  photo.alt = 'Foto do aluno';
  photo.style.width = '42px';
  photo.style.height = '42px';
  photo.style.borderRadius = '50%';
  photo.style.objectFit = 'cover';
  photo.style.border = '1px solid #ccc';
  photo.style.display = 'none';
  photo.id = 'mkInlinePhoto';

  const nameBox = document.createElement('div');
  const nameEl = document.createElement('strong');
  nameEl.id = 'mkInlineName';
  const emailEl = document.createElement('div');
  emailEl.id = 'mkInlineEmail';
  emailEl.style.fontSize = '12px';
  emailEl.style.opacity = '0.85';
  nameBox.appendChild(nameEl);
  nameBox.appendChild(emailEl);

  head.appendChild(photo);
  head.appendChild(nameBox);

  // médias
  const ul = document.createElement('ul');
  ul.className = 'lista';
  ul.style.marginTop = '10px';
  ul.id = 'mkInlineAvgs';

  // redações
  const h4 = document.createElement('h4');
  h4.textContent = 'Redações do aluno';
  h4.style.marginTop = '10px';

  const essaysUl = document.createElement('ul');
  essaysUl.className = 'lista';
  essaysUl.id = 'mkInlineEssays';

  wrap.appendChild(head);
  wrap.appendChild(ul);
  wrap.appendChild(h4);
  wrap.appendChild(essaysUl);

  return wrap;
}

function fillInlinePanel(panel, studentGroup, medias) {
  if (!panel) return;

  // nome/email/foto
  const nameEl = panel.querySelector('#mkInlineName');
  const emailEl = panel.querySelector('#mkInlineEmail');
  const photoEl = panel.querySelector('#mkInlinePhoto');

  const nome =
    studentGroup.studentName && String(studentGroup.studentName).trim()
      ? studentGroup.studentName
      : 'Aluno';
  const email =
    studentGroup.studentEmail && String(studentGroup.studentEmail).trim()
      ? studentGroup.studentEmail
      : '';

  if (nameEl) nameEl.textContent = nome;
  if (emailEl) emailEl.textContent = email;

  const dataUrl = getStudentPhotoDataUrl(studentGroup.studentId);
  if (photoEl) {
    if (dataUrl) {
      photoEl.src = dataUrl;
      photoEl.style.display = 'inline-block';
    } else {
      photoEl.removeAttribute('src');
      photoEl.style.display = 'none';
    }
  }

  // médias
  const avgsUl = panel.querySelector('#mkInlineAvgs');
  if (avgsUl) {
    avgsUl.innerHTML = `
      <li>Média total: <strong>${medias.mTotal ?? '—'}</strong></li>
      <li>C1 — Domínio da norma culta: <strong>${medias.mC1 ?? '—'}</strong></li>
      <li>C2 — Compreensão do tema e repertório: <strong>${medias.mC2 ?? '—'}</strong></li>
      <li>C3 — Argumentação e projeto de texto: <strong>${medias.mC3 ?? '—'}</strong></li>
      <li>C4 — Coesão e mecanismos linguísticos: <strong>${medias.mC4 ?? '—'}</strong></li>
      <li>C5 — Proposta de intervenção: <strong>${medias.mC5 ?? '—'}</strong></li>
    `;
  }

  // redações
  const essaysUl = panel.querySelector('#mkInlineEssays');
  if (!essaysUl) return;

  essaysUl.innerHTML = '';
  const essays = [...(studentGroup.essays || [])];
  essays.sort((a, b) => (a.taskTitle || '').localeCompare(b.taskTitle || ''));

  essays.forEach((e) => {
    const li = document.createElement('li');

    const title = document.createElement('strong');
    title.textContent = e.taskTitle || 'Tarefa';

    const nota = document.createElement('div');
    nota.textContent =
      e.score !== null && e.score !== undefined
        ? `Nota: ${e.score} (C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${
            e.c4 ?? '—'
          } C5 ${e.c5 ?? '—'})`
        : 'Sem correção';

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação/feedback';
    btn.onclick = () => {
      const tId = e.taskId || e.task?.id || null;
      if (!tId) {
        alert('Não encontrei o taskId desta redação no retorno do servidor.');
        return;
      }
      window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(
        tId
      )}&studentId=${encodeURIComponent(studentGroup.studentId)}`;
    };

    li.appendChild(title);
    li.appendChild(document.createElement('br'));
    li.appendChild(nota);
    li.appendChild(document.createElement('br'));
    li.appendChild(btn);

    essaysUl.appendChild(li);
  });
}

// =====================
// Carregar desempenho
// =====================
async function carregarDados() {
  try {
    setStatus('Carregando...');

    // ✅ pega os alunos ativos (matriculados)
    const activeSet = await getActiveStudentsSet();

    const res = await fetch(
      `${API_URL}/essays/performance/by-room?roomId=${encodeURIComponent(roomId)}`
    );
    if (!res.ok) throw new Error();

    let data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      setStatus('Ainda não há redações nesta sala.');
      if (studentsList) studentsList.innerHTML = '<li>Nenhuma redação enviada ainda.</li>';

      setText(avgTotal, null);
      setText(avgC1, null);
      setText(avgC2, null);
      setText(avgC3, null);
      setText(avgC4, null);
      setText(avgC5, null);
      return;
    }

    // ✅ FILTRO: só alunos ativos
    if (activeSet && activeSet.size > 0) {
      data = data.filter((e) => activeSet.has(String(e.studentId)));
    }

    if (data.length === 0) {
      setStatus('Não há redações de alunos ativos nesta sala.');
      if (studentsList) studentsList.innerHTML = '<li>Nenhuma redação de alunos ativos.</li>';

      setText(avgTotal, null);
      setText(avgC1, null);
      setText(avgC2, null);
      setText(avgC3, null);
      setText(avgC4, null);
      setText(avgC5, null);
      return;
    }

    // só corrigidas para médias
    const corrected = data.filter((e) => e.score !== null && e.score !== undefined);

    setText(avgTotal, mean(corrected.map((e) => e.score)));
    setText(avgC1, mean(corrected.map((e) => e.c1)));
    setText(avgC2, mean(corrected.map((e) => e.c2)));
    setText(avgC3, mean(corrected.map((e) => e.c3)));
    setText(avgC4, mean(corrected.map((e) => e.c4)));
    setText(avgC5, mean(corrected.map((e) => e.c5)));

    // agrupar por aluno
    const byStudent = new Map();

    data.forEach((e) => {
      const sid = e.studentId;
      if (!sid) return;

      if (!byStudent.has(sid)) {
        byStudent.set(sid, {
          studentId: sid,
          studentName: e.studentName || '',
          studentEmail: e.studentEmail || '',
          essays: [],
        });
      }

      const g = byStudent.get(sid);
      if (!g.studentName && e.studentName) g.studentName = e.studentName;
      if (!g.studentEmail && e.studentEmail) g.studentEmail = e.studentEmail;

      g.essays.push(e);
    });

    if (studentsList) {
      studentsList.innerHTML = '';

      const students = Array.from(byStudent.values());
      students.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

      students.forEach((s) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'flex-start';
        li.style.gap = '10px';

        const avatar = makeAvatar(s.studentId, 38);

        const content = document.createElement('div');
        content.style.flex = '1';

        const correctedEssays = s.essays.filter((e) => e.score !== null && e.score !== undefined);

        const mTotal = mean(correctedEssays.map((e) => e.score));
        const mC1 = mean(correctedEssays.map((e) => e.c1));
        const mC2 = mean(correctedEssays.map((e) => e.c2));
        const mC3 = mean(correctedEssays.map((e) => e.c3));
        const mC4 = mean(correctedEssays.map((e) => e.c4));
        const mC5 = mean(correctedEssays.map((e) => e.c5));

        const nome = s.studentName && String(s.studentName).trim() ? s.studentName : 'Aluno';
        const email = s.studentEmail && String(s.studentEmail).trim() ? s.studentEmail : '';

        const header = document.createElement('div');
        header.innerHTML = `<strong>${nome}</strong>${email ? `<br><small>${email}</small>` : ''}`;

        const resumo = document.createElement('div');
        resumo.textContent =
          `Média: ${mTotal ?? '—'} | ` +
          `C1 ${mC1 ?? '—'} C2 ${mC2 ?? '—'} C3 ${mC3 ?? '—'} C4 ${mC4 ?? '—'} C5 ${mC5 ?? '—'}`;

        const btn = document.createElement('button');
        btn.textContent = 'Ver desempenho individual';

        // ✅ painel inline (fica DENTRO do li)
        const inlinePanel = buildInlinePanel();

        function toggleInline() {
          const isOpen = inlinePanel.style.display === 'block';

          closeAllInlinePanels();

          if (!isOpen) {
            fillInlinePanel(inlinePanel, s, { mTotal, mC1, mC2, mC3, mC4, mC5 });
            inlinePanel.style.display = 'block';
          }
        }

        btn.onclick = (ev) => {
          ev.stopPropagation();
          toggleInline();
        };

        // opcional: clicar no item também abre
        li.style.cursor = 'pointer';
        li.title = 'Clique para ver o desempenho individual';
        li.addEventListener('click', (ev) => {
          if (ev.target && ev.target.tagName === 'BUTTON') return;
          toggleInline();
        });

        content.appendChild(header);
        content.appendChild(document.createElement('br'));
        content.appendChild(resumo);
        content.appendChild(document.createElement('br'));
        content.appendChild(btn);
        content.appendChild(inlinePanel);

        li.appendChild(avatar);
        li.appendChild(content);

        studentsList.appendChild(li);
      });
    }

    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao carregar dados de desempenho.');
    if (studentsList) studentsList.innerHTML = '<li>Erro ao carregar.</li>';
  }
}

// INIT
carregarSala();
carregarDados();
