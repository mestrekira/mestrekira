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

const studentPanel = document.getElementById('studentPanel');
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');
const studentPhotoImg = document.getElementById('studentPhotoImg');

const sAvgTotal = document.getElementById('sAvgTotal');
const sAvgC1 = document.getElementById('sAvgC1');
const sAvgC2 = document.getElementById('sAvgC2');
const sAvgC3 = document.getElementById('sAvgC3');
const sAvgC4 = document.getElementById('sAvgC4');
const sAvgC5 = document.getElementById('sAvgC5');

const studentEssaysList = document.getElementById('studentEssaysList');

function mean(nums) {
  const v = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '—' : String(value);
}

/** ✅ Foto local (mesma do perfil do aluno) */
function studentPhotoKey(studentId) {
  return studentId ? `mk_photo_student_${studentId}` : null;
}

function setStudentPhoto(studentId) {
  if (!studentPhotoImg) return;

  const key = studentPhotoKey(studentId);
  const dataUrl = key ? localStorage.getItem(key) : null;

  if (dataUrl) {
    studentPhotoImg.src = dataUrl;
    studentPhotoImg.style.display = 'inline-block';
  } else {
    studentPhotoImg.removeAttribute('src');
    studentPhotoImg.style.display = 'none';
  }
}

function makeAvatar(studentId, size = 34) {
  const img = document.createElement('img');
  img.alt = 'Foto do aluno';
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.border = '1px solid #ccc';

  const key = studentPhotoKey(studentId);
  const dataUrl = key ? localStorage.getItem(key) : null;

  if (dataUrl) {
    img.src = dataUrl;
  } else {
    // placeholder simples
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <rect width="100%" height="100%" fill="#eee"/>
          <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">?</text>
        </svg>`
      );
  }

  return img;
}

async function carregarSala() {
  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) throw new Error();
    const room = await res.json();
    if (roomNameEl) roomNameEl.textContent = room?.name || 'Sala';
  } catch {
    if (roomNameEl) roomNameEl.textContent = 'Sala';
  }
}

/**
 * ✅ Importante:
 * Seu backend (essays.service.ts) hoje retorna performanceByRoom como lista de alunos agrupados
 * { studentId, studentName, studentEmail, averageScore, essays: [{id, taskId, score, c1..c5}] }
 *
 * Então aqui a gente consome como "lista de alunos", não como "lista de redações".
 */
async function carregarDados() {
  try {
    if (statusEl) statusEl.textContent = 'Carregando...';

    const res = await fetch(
      `${API_URL}/essays/performance/by-room?roomId=${encodeURIComponent(roomId)}`
    );
    if (!res.ok) throw new Error();

    const raw = await res.json();

    // ✅ normaliza para LISTA PLANA: 1 item por redação
    let essays = [];

    if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]?.essays)) {
      // formato AGRUPADO (por aluno)
      raw.forEach((g) => {
        const studentId = g.studentId;
        const studentName = g.studentName;
        const studentEmail = g.studentEmail;
        (g.essays || []).forEach((e) => {
          essays.push({
            id: e.id,
            taskId: e.taskId,
            taskTitle: e.taskTitle || '', // pode não vir
            studentId,
            studentName,
            studentEmail,
            score: e.score ?? null,
            c1: e.c1 ?? null,
            c2: e.c2 ?? null,
            c3: e.c3 ?? null,
            c4: e.c4 ?? null,
            c5: e.c5 ?? null,
          });
        });
      });
    } else if (Array.isArray(raw)) {
      // formato PLANO (por redação)
      essays = raw;
    }

    if (!Array.isArray(essays) || essays.length === 0) {
      if (statusEl) statusEl.textContent = 'Ainda não há redações nesta sala.';
      if (studentsList) studentsList.innerHTML = '<li>Nenhuma redação enviada ainda.</li>';
      setText(avgTotal, null); setText(avgC1, null); setText(avgC2, null);
      setText(avgC3, null); setText(avgC4, null); setText(avgC5, null);
      if (studentPanel) studentPanel.style.display = 'none';
      return;
    }

    // médias gerais só das corrigidas
    const corrected = essays.filter((e) => e.score !== null && e.score !== undefined);
    setText(avgTotal, mean(corrected.map((e) => e.score)));
    setText(avgC1, mean(corrected.map((e) => e.c1)));
    setText(avgC2, mean(corrected.map((e) => e.c2)));
    setText(avgC3, mean(corrected.map((e) => e.c3)));
    setText(avgC4, mean(corrected.map((e) => e.c4)));
    setText(avgC5, mean(corrected.map((e) => e.c5)));

    // agrupar por aluno no front
    const byStudent = new Map();
    essays.forEach((e) => {
      if (!e.studentId) return;
      if (!byStudent.has(e.studentId)) {
        byStudent.set(e.studentId, {
          studentId: e.studentId,
          studentName: e.studentName || '',
          studentEmail: e.studentEmail || '',
          essays: [],
        });
      }
      byStudent.get(e.studentId).essays.push(e);
    });

    if (studentsList) studentsList.innerHTML = '';

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

      const correctedEssays = (s.essays || []).filter((e) => e.score !== null && e.score !== undefined);
      const mTotal = mean(correctedEssays.map((e) => e.score));
      const mC1 = mean(correctedEssays.map((e) => e.c1));
      const mC2 = mean(correctedEssays.map((e) => e.c2));
      const mC3 = mean(correctedEssays.map((e) => e.c3));
      const mC4 = mean(correctedEssays.map((e) => e.c4));
      const mC5 = mean(correctedEssays.map((e) => e.c5));

      const nome = (s.studentName || '').trim() ? s.studentName : 'Aluno';
      const email = (s.studentEmail || '').trim() ? s.studentEmail : '';

      const header = document.createElement('div');
      header.innerHTML = `<strong>${nome}</strong>${email ? `<br><small>${email}</small>` : ''}`;

      const resumo = document.createElement('div');
      resumo.textContent = `Média: ${mTotal ?? '—'} | C1 ${mC1 ?? '—'} C2 ${mC2 ?? '—'} C3 ${mC3 ?? '—'} C4 ${mC4 ?? '—'} C5 ${mC5 ?? '—'}`;

      const btn = document.createElement('button');
      btn.textContent = 'Ver desempenho individual';
      btn.onclick = () => abrirAluno(s, { mTotal, mC1, mC2, mC3, mC4, mC5 });

      content.appendChild(header);
      content.appendChild(document.createElement('br'));
      content.appendChild(resumo);
      content.appendChild(document.createElement('br'));
      content.appendChild(btn);

      li.appendChild(avatar);
      li.appendChild(content);

      studentsList.appendChild(li);
    });

    if (statusEl) statusEl.textContent = '';
  } catch (e) {
    console.error(e);
    if (statusEl) statusEl.textContent = 'Erro ao carregar dados de desempenho.';
    if (studentsList) studentsList.innerHTML = '<li>Erro ao carregar.</li>';
    if (studentPanel) studentPanel.style.display = 'none';
  }
}

function abrirAluno(studentGroup, medias) {
  if (!studentPanel) return;
  studentPanel.style.display = 'block';

  if (studentNameEl) {
    studentNameEl.textContent =
      studentGroup.studentName && String(studentGroup.studentName).trim()
        ? studentGroup.studentName
        : 'Aluno';
  }

  if (studentEmailEl) {
    studentEmailEl.textContent =
      studentGroup.studentEmail && String(studentGroup.studentEmail).trim()
        ? studentGroup.studentEmail
        : '';
  }

  setStudentPhoto(studentGroup.studentId);

  setText(sAvgTotal, medias.mTotal ?? null);
  setText(sAvgC1, medias.mC1 ?? null);
  setText(sAvgC2, medias.mC2 ?? null);
  setText(sAvgC3, medias.mC3 ?? null);
  setText(sAvgC4, medias.mC4 ?? null);
  setText(sAvgC5, medias.mC5 ?? null);

  if (studentEssaysList) studentEssaysList.innerHTML = '';

  const essays = [...(studentGroup.essays || [])];

  // ✅ ordenar por taskId (não temos taskTitle no retorno atual do backend)
  essays.sort((a, b) => (a.taskId || '').localeCompare(b.taskId || ''));

  essays.forEach((e) => {
    const li = document.createElement('li');

    const title = document.createElement('strong');
    title.textContent = e.taskTitle || e.taskId || 'Tarefa';

    const nota = document.createElement('div');
    nota.textContent =
      e.score !== null && e.score !== undefined
        ? `Nota: ${e.score} (C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${
            e.c4 ?? '—'
          } C5 ${e.c5 ?? '—'})`
        : 'Sem correção';

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação/feedback';

    // ✅ professor vai para página de professor (por essayId)
    btn.onclick = () => {
      window.location.href = `feedback-professor.html?essayId=${encodeURIComponent(e.id)}`;
    };

    li.appendChild(title);
    li.appendChild(document.createElement('br'));
    li.appendChild(nota);
    li.appendChild(document.createElement('br'));
    li.appendChild(btn);

    if (studentEssaysList) studentEssaysList.appendChild(li);
  });
}

// INIT
carregarSala();
carregarDados();
