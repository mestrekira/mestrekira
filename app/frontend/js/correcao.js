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

const taskTitleEl = document.getElementById('taskTitle');
const taskMetaEl = document.getElementById('taskMeta'); // opcional

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

// cache da sala da tarefa (para filtro de alunos ativos)
let taskRoomId = null;

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
    if (totalScoreEl) totalScoreEl.textContent = '—';
    return null;
  }

  const total = v1 + v2 + v3 + v4 + v5;
  if (totalScoreEl)
