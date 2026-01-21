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

const sAvgTotal = document.getElementById('sAvgTotal');
const sAvgC1 = document.getElementById('sAvgC1');
const sAvgC2 = document.getElementById('sAvgC2');
const sAvgC3 = document.getElementById('sAvgC3');
const sAvgC4 = document.getElementById('sAvgC4');
const sAvgC5 = document.getElementById('sAvgC5');

const studentEssaysList = document.getElementById('studentEssaysList');

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

function mean(nums) {
  const v = nums.filter(n => typeof n === 'number' && !Number.isNaN(n));
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function setText(el, value) {
  el.textContent = (value === null || value === undefined) ? '—' : String(value);
}

async function carregarSala() {
  try {
    const res = await fetch(`${API_URL}/rooms/${roomId}`);
    if (!res.ok) throw new Error();
    const room = await res.json();
    roomNameEl.textContent = room.name || 'Sala';
  } catch {
    roomNameEl.textContent = 'Sala';
  }
}

async function carregarDados() {
  try {
    statusEl.textContent = 'Carregando...';

    const res = await fetch(`${API_URL}/essays/performance/by-room?roomId=${roomId}`);
    if (!res.ok) throw new Error();

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      statusEl.textContent = 'Ainda não há redações nesta sala.';
      studentsList.innerHTML = '<li>Nenhuma redação enviada ainda.</li>';

      setText(avgTotal, null);
      setText(avgC1, null);
      setText(avgC2, null);
      setText(avgC3, null);
      setText(avgC4, null);
      setText(avgC5, null);

      studentPanel.style.display = 'none';
      return;
    }

    // ✅ só corrigidas para médias
    const corrected = data.filter(e => e.score !== null && e.score !== undefined);

    setText(avgTotal, mean(corrected.map(e => e.score)));
    setText(avgC1, mean(corrected.map(e => e.c1)));
    setText(avgC2, mean(corrected.map(e => e.c2)));
    setText(avgC3, mean(corrected.map(e => e.c3)));
    setText(avgC4, mean(corrected.map(e => e.c4)));
    setText(avgC5, mean(corrected.map(e => e.c5)));

    // agrupar por aluno
    const byStudent = new Map();
    data.forEach(e => {
      if (!byStudent.has(e.studentId)) {
        byStudent.set(e.studentId, {
          studentId: e.studentId,
          studentName: e.studentName,
          studentEmail: e.studentEmail,
          essays: [],
        });
      }
      byStudent.get(e.studentId).essays.push(e);
    });

    studentsList.innerHTML = '';

    const students = Array.from(byStudent.values());

    // ordenar por nome
    students.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

    students.forEach(s => {
      const li = document.createElement('li');

      const correctedEssays = s.essays.filter(e => e.score !== null && e.score !== undefined);

      const mTotal = mean(correctedEssays.map(e => e.score));
      const mC1 = mean(correctedEssays.map(e => e.c1));
      const mC2 = mean(correctedEssays.map(e => e.c2));
      const mC3 = mean(correctedEssays.map(e => e.c3));
      const mC4 = mean(correctedEssays.map(e => e.c4));
      const mC5 = mean(correctedEssays.map(e => e.c5));

      // ✅ header com foto
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '10px';

      const avatar = document.createElement('img');
      avatar.width = 36;
      avatar.height = 36;
      avatar.style.borderRadius = '50%';
      avatar.style.objectFit = 'cover';
      avatar.style.border = '1px solid #ccc';

      const nome = s.studentName && s.studentName.trim() ? s.studentName : 'Aluno';
      const dataUrl = localStorage.getItem(photoKeyStudent(s.studentId));
      avatar.src = dataUrl || placeholderAvatarDataUrl(nome.trim().slice(0, 1).toUpperCase());

      const info = document.createElement('div');
      info.innerHTML = `<strong>${nome}</strong><br><small>${s.studentEmail || ''}</small>`;

      header.appendChild(avatar);
      header.appendChild(info);

      const resumo = document.createElement('div');
      resumo.textContent = `Média: ${mTotal ?? '—'} | C1 ${mC1 ?? '—'} C2 ${mC2 ?? '—'} C3 ${mC3 ?? '—'} C4 ${mC4 ?? '—'} C5 ${mC5 ?? '—'}`;

      const btn = document.createElement('button');
      btn.textContent = 'Ver desempenho individual';
      btn.onclick = () => abrirAluno(s, { mTotal, mC1, mC2, mC3, mC4, mC5 });

      li.appendChild(header);
      li.appendChild(document.createElement('br'));
      li.appendChild(resumo);
      li.appendChild(document.createElement('br'));
      li.appendChild(btn);

      studentsList.appendChild(li);
    });

    statusEl.textContent = '';
  } catch {
    statusEl.textContent = 'Erro ao carregar dados de desempenho.';
    studentsList.innerHTML = '<li>Erro ao carregar.</li>';
    studentPanel.style.display = 'none';
  }
}

function abrirAluno(studentGroup, medias) {
  studentPanel.style.display = 'block';

  studentNameEl.textContent = studentGroup.studentName || 'Aluno';
  studentEmailEl.textContent = studentGroup.studentEmail || '';

  setText(sAvgTotal, medias.mTotal ?? null);
  setText(sAvgC1, medias.mC1 ?? null);
  setText(sAvgC2, medias.mC2 ?? null);
  setText(sAvgC3, medias.mC3 ?? null);
  setText(sAvgC4, medias.mC4 ?? null);
  setText(sAvgC5, medias.mC5 ?? null);

  studentEssaysList.innerHTML = '';

  const essays = [...studentGroup.essays];
  essays.sort((a, b) => (a.taskTitle || '').localeCompare(b.taskTitle || ''));

  essays.forEach(e => {
    const li = document.createElement('li');

    const title = document.createElement('strong');
    title.textContent = e.taskTitle || 'Tarefa';

    const nota = document.createElement('div');
    nota.textContent = (e.score !== null && e.score !== undefined)
      ? `Nota: ${e.score} (C1 ${e.c1 ?? '—'} C2 ${e.c2 ?? '—'} C3 ${e.c3 ?? '—'} C4 ${e.c4 ?? '—'} C5 ${e.c5 ?? '—'})`
      : 'Sem correção';

    const btn = document.createElement('button');
    btn.textContent = 'Ver redação/feedback';
    btn.onclick = () => {
      // ✅ Vai para a correção do professor e já abre o aluno (não vai para página do aluno)
      window.location.href = `correcao.html?taskId=${encodeURIComponent(e.taskId)}&studentId=${encodeURIComponent(e.studentId)}`;
    };

    li.appendChild(title);
    li.appendChild(document.createElement('br'));
    li.appendChild(nota);
    li.appendChild(document.createElement('br'));
    li.appendChild(btn);

    studentEssaysList.appendChild(li);
  });
}

// INIT
carregarSala();
carregarDados();
