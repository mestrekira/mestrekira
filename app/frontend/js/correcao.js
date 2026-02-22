// correcao.js (reconstruído / final / prático)
// - usa auth.js (notify + requireProfessorSession + authFetch + readErrorMessage)
// - corrige inconsistências do diff antigo (fetch duplicado, authFetch duplicado, applyBoxStyle duplicado etc.)
// - lista redações por tarefa e permite corrigir (C1..C5 + feedback)
// - filtra redações de alunos removidos (se possível obter roomId pela task)

import { API_URL } from './config.js';
import { confirmDialog as uiConfirmDialog } from './ui-feedback.js';
import {
  notify,
  requireProfessorSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// -------------------- PARAMS + GUARD --------------------
const params = new URLSearchParams(window.location.search);
const taskId = params.get('taskId');
const focusStudentId = params.get('studentId'); // opcional: abrir direto um aluno

requireProfessorSession({ redirectTo: 'login-professor.html' });

if (!taskId) {
  notify('error', 'Tarefa inválida', 'Acesse a correção por uma tarefa válida.');
  window.location.replace('professor-salas.html');
  throw new Error('taskId ausente');
}

// -------------------- ELEMENTOS (com fallback) --------------------
const essaysList = document.getElementById('essaysList');
const correctionSection = document.getElementById('correctionSection');

// Área de tema/orientações (opcionais)
const taskTitleEl = document.getElementById('taskTitle');
const taskMetaEl = document.getElementById('taskMeta');

// Área do painel de correção (IDs mais comuns)
const statusEl = document.getElementById('status');
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');
const sentAtEl = document.getElementById('sentAt');
const correctedAtEl = document.getElementById('correctedAt');

const essayBoxEl =
  document.getElementById('essayBox') ||
  document.getElementById('essayContent') ||
  document.getElementById('essayTextBox');

const feedbackInputEl =
  document.getElementById('feedbackInput') ||
  document.getElementById('feedback') ||
  document.getElementById('teacherFeedback');

const totalEl =
  document.getElementById('totalScore') ||
  document.getElementById('total') ||
  document.getElementById('scoreTotal');

const saveBtn =
  document.getElementById('saveBtn') ||
  document.getElementById('saveCorrectionBtn');

const closeBtn =
  document.getElementById('closeBtn') ||
  document.getElementById('closeCorrectionBtn');

const c1Input = pickEl(['c1', 'c1Input', 'comp1', 'v1']);
const c2Input = pickEl(['c2', 'c2Input', 'comp2', 'v2']);
const c3Input = pickEl(['c3', 'c3Input', 'comp3', 'v3']);
const c4Input = pickEl(['c4', 'c4Input', 'comp4', 'v4']);
const c5Input = pickEl(['c5', 'c5Input', 'comp5', 'v5']);

function pickEl(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

// Se a página não tem lista, é HTML inconsistente.
if (!essaysList) {
  console.error('[correcao] #essaysList não encontrado no HTML.');
  notify('error', 'Erro', 'Página de correção incompleta (lista não encontrada).');
  throw new Error('essaysList ausente');
}

// -------------------- estado --------------------
let currentEssayId = null;
let cachedActiveSet = null;
let currentAnchorLi = null;

// painel pode ser movido na DOM (ancorar abaixo do item)
const initialCorrectionParent = correctionSection?.parentElement || null;
const initialCorrectionNextSibling = correctionSection?.nextSibling || null;

// -------------------- UI helpers --------------------
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

async function confirmDialog(opts) {
  if (typeof uiConfirmDialog === 'function') {
    try {
      return await uiConfirmDialog(opts);
    } catch {
      // fallback abaixo
    }
  }
  return window.confirm(`${opts?.title ? opts.title + '\n\n' : ''}${opts?.message || 'Confirmar?'}`);
}

// -------------------- API helpers --------------------
async function apiJson(url, options) {
  const res = await authFetch(url, options || {}, { redirectTo: 'login-professor.html' });
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

function unwrapResult(data) {
  // aceita: array direto, {result:...}, {data:...}, objeto direto
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (data.result && typeof data.result === 'object') return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') return data.data;
  }
  return data;
}

// -------------------- datas --------------------
function pickDate(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function toDateSafe(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d0 = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d0.getTime()) ? null : d0;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBR(value) {
  const d = toDateSafe(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return '—';
  }
}

function getSentAt(essay) {
  return pickDate(essay, ['submittedAt', 'submitted_at', 'createdAt', 'created_at']);
}

// “corrigida” só faz sentido se houver score ou feedback
function isCorrected(essay) {
  const hasScore = essay?.score !== null && essay?.score !== undefined && !Number.isNaN(Number(essay.score));
  const hasFeedback = String(essay?.feedback || '').trim().length > 0;
  return hasScore || hasFeedback;
}

// -------------------- box style / render --------------------
function applyBoxStyle(el) {
  if (!el) return;
  el.style.setProperty('white-space', 'pre-wrap', 'important');
  el.style.setProperty('line-height', '1.6', 'important');
  el.style.setProperty('text-align', 'justify', 'important');
  el.style.setProperty('overflow-wrap', 'anywhere', 'important');
  el.style.setProperty('word-break', 'break-word', 'important');
  el.style.setProperty('padding', '14px 16px', 'important');
}

function setBoxText(el, value, fallback = '') {
  if (!el) return;
  const raw = value === null || value === undefined ? '' : String(value).replace(/\r\n/g, '\n');
  const finalText = raw.trim() ? raw : fallback;
  el.textContent = finalText;
  applyBoxStyle(el);
}

function renderGuidelinesInBox(el, title, guidelines) {
  if (!el) return;

  const g = String(guidelines || '').replace(/\r\n/g, '\n');
  const hasText = g.trim().length > 0;

  el.innerHTML = '';
  applyBoxStyle(el);

  const h = document.createElement('div');
  h.textContent = String(title || '').trim();
  h.style.fontWeight = '800';
  h.style.marginBottom = '10px';
  h.style.textAlign = 'left';
  el.appendChild(h);

  if (!hasText) {
    const p = document.createElement('div');
    p.textContent = 'Sem orientações adicionais.';
    el.appendChild(p);
    return;
  }

  const body = document.createElement('div');
  body.textContent = g;
  body.style.whiteSpace = 'pre-wrap';
  body.style.textAlign = 'justify';
  el.appendChild(body);
}

// --- conteúdo da redação: compat com __TITLE__ ---
function splitTitleAndBody(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');

  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim() || '—',
      body: String(m[2] || '').trimEnd(),
    };
  }

  const trimmed = text.trim();
  if (!trimmed) return { title: '—', body: '' };

  const lines = text.split('\n');
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '—', body: '' };

  let title = String(lines[firstIdx] || '').trim();
  if (title.startsWith('__TITLE__:')) title = title.replace(/^__TITLE__:\s*/, '').trim();

  const bodyLines = lines.slice(firstIdx + 1);
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) bodyLines.shift();
  const body = bodyLines.join('\n').trimEnd();

  return { title: title || '—', body };
}

function renderEssayForProfessor(containerEl, packedContent) {
  if (!containerEl) return;

  const { title, body } = splitTitleAndBody(packedContent);

  containerEl.innerHTML = '';
  applyBoxStyle(containerEl);

  if (title && title !== '—') {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.textAlign = 'center';
    h.style.fontWeight = '800';
    h.style.marginBottom = '10px';
    containerEl.appendChild(h);
  }

  const b = document.createElement('div');
  b.textContent = String(body || '').replace(/\r\n/g, '\n').trimEnd();
  b.style.whiteSpace = 'pre-wrap';
  b.style.textAlign = 'justify';
  containerEl.appendChild(b);
}

// -------------------- fotos (placeholder) --------------------
function photoKeyStudent(studentId) {
  return `mk_photo_student_${studentId}`;
}

function placeholderAvatarDataUrl(letter = '?') {
  const ch = String(letter || '?').slice(0, 1).toUpperCase();
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="14" text-anchor="middle" fill="#888">${ch}</text>
      </svg>`
    )
  );
}

// -------------------- students set (filtrar órfãos) --------------------
async function getTaskInfo(taskIdValue) {
  try {
    const res = await authFetch(`${API_URL}/tasks/${encodeURIComponent(taskIdValue)}`, { method: 'GET' }, { redirectTo: 'login-professor.html' });
    if (!res.ok) return null;
    const task = await res.json().catch(() => null);
    return task || null;
  } catch {
    return null;
  }
}

async function getActiveStudentsSet(roomId) {
  try {
    const res = await authFetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/students`, { method: 'GET' }, { redirectTo: 'login-professor.html' });
    if (!res.ok) return null;
    const list = await res.json().catch(() => null);
    const arr = Array.isArray(list) ? list : (Array.isArray(list?.result) ? list.result : Array.isArray(list?.data) ? list.data : []);
    const ids = arr
      .map((s) => String(s?.id || s?.studentId || '').trim())
      .filter(Boolean);
    return new Set(ids);
  } catch {
    return null;
  }
}

function filterEssaysByActiveStudents(essays, activeSet) {
  if (!activeSet) return Array.isArray(essays) ? essays : [];
  return (Array.isArray(essays) ? essays : []).filter((e) =>
    activeSet.has(String(e?.studentId || '').trim())
  );
}

// -------------------- carregar tema/orientações --------------------
async function carregarTemaDaTarefa() {
  try {
    const task = await getTaskInfo(taskId);
    const titleRaw = String(task?.title || '').trim();

    if (taskTitleEl) {
      taskTitleEl.textContent = titleRaw ? `Tema: ${titleRaw}` : 'Tema: —';
      taskTitleEl.style.setProperty('padding', '0 6px', 'important');
    }

    if (taskMetaEl) {
      renderGuidelinesInBox(taskMetaEl, 'Orientações', String(task?.guidelines || ''));
    }

    // tenta preparar filtro de alunos ativos (se task tiver roomId)
    const roomIdFromTask = String(task?.roomId || task?.room?.id || '').trim();
    if (roomIdFromTask) {
      cachedActiveSet = await getActiveStudentsSet(roomIdFromTask);
    } else {
      cachedActiveSet = null;
    }

    return task || null;
  } catch (e) {
    console.error(e);
    if (taskTitleEl) taskTitleEl.textContent = 'Tema: —';
    if (taskMetaEl) setBoxText(taskMetaEl, '', 'Não foi possível carregar orientações.');
    cachedActiveSet = null;
    return null;
  }
}

// -------------------- lista de redações --------------------
function normalizeEssayItem(e) {
  const id = String(e?.id || e?.essayId || '').trim();
  const studentId = String(e?.studentId || e?.student?.id || '').trim();
  const studentName = String(e?.studentName || e?.student?.name || e?.name || '').trim();
  const studentEmail = String(e?.studentEmail || e?.student?.email || e?.email || '').trim();
  const content = e?.content ?? e?.essayContent ?? '';
  const feedback = e?.feedback ?? '';
  const score = e?.score ?? null;

  return {
    id,
    studentId,
    studentName,
    studentEmail,
    content,
    feedback,
    score,
    c1: e?.c1 ?? null,
    c2: e?.c2 ?? null,
    c3: e?.c3 ?? null,
    c4: e?.c4 ?? null,
    c5: e?.c5 ?? null,
    createdAt: getSentAt(e),
    updatedAt: pickDate(e, ['correctedAt', 'corrected_at', 'updatedAt', 'updated_at']),
    _raw: e,
  };
}

function sortEssaysForList(arr) {
  const list = Array.isArray(arr) ? [...arr] : [];

  // pendentes primeiro, corrigidas depois
  list.sort((a, b) => {
    const ac = isCorrected(a) ? 1 : 0;
    const bc = isCorrected(b) ? 1 : 0;
    if (ac !== bc) return ac - bc;

    // mais recentes primeiro dentro do grupo
    const at = toDateSafe(getSentAt(a))?.getTime?.() ?? -Infinity;
    const bt = toDateSafe(getSentAt(b))?.getTime?.() ?? -Infinity;
    if (at !== bt) return bt - at;

    // fallback: nome
    return String(a?.studentName || '').localeCompare(String(b?.studentName || ''), 'pt-BR');
  });

  return list;
}

function renderMaisRecenteBadge() {
  const badge = document.createElement('span');
  badge.textContent = 'Mais recente';
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.padding = '3px 10px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = '900';
  badge.style.marginLeft = '10px';
  badge.style.background = 'rgba(16,185,129,.12)';
  badge.style.border = '1px solid rgba(16,185,129,.35)';
  badge.style.color = '#0b1f4b';
  return badge;
}

function computeNewestEssayId(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let newestId = null;
  let newestTime = -Infinity;
  for (const e of items) {
    const t = toDateSafe(getSentAt(e))?.getTime?.() ?? NaN;
    if (!Number.isNaN(t) && t > newestTime) {
      newestTime = t;
      newestId = e.id;
    }
  }
  return newestId || items[0]?.id || null;
}

async function fetchEssaysWithStudent() {
  const res = await authFetch(
    `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/with-student`,
    { method: 'GET' },
    { redirectTo: 'login-professor.html' }
  );

  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  const data = await res.json().catch(() => null);

  // pode vir array direto ou embrulhado
  const raw = unwrapResult(data);
  return Array.isArray(raw) ? raw : [];
}

async function fetchEssayById(essayIdValue) {
  const res = await authFetch(
    `${API_URL}/essays/${encodeURIComponent(String(essayIdValue))}`,
    { method: 'GET' },
    { redirectTo: 'login-professor.html' }
  );
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

async function carregarRedacoes() {
  essaysList.innerHTML = '<li>Carregando redações...</li>';

  try {
    currentEssayId = null;
    currentAnchorLi = null;

    let essaysRaw = await fetchEssaysWithStudent();

    // filtra órfãos (se foi possível montar activeSet)
    essaysRaw = filterEssaysByActiveStudents(essaysRaw, cachedActiveSet);

    const items = sortEssaysForList(
      essaysRaw.map(normalizeEssayItem).filter((x) => !!x.id && !!x.studentId)
    );

    essaysList.innerHTML = '';

    if (items.length === 0) {
      essaysList.innerHTML = '<li>Nenhuma redação enviada para esta tarefa.</li>';
      closeCorrection(true);
      return;
    }

    const newestId = computeNewestEssayId(items);

    for (const item of items) {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '10px';
      li.style.padding = '10px 12px';
      li.style.borderRadius = '12px';

      const corrected = isCorrected(item);
      const statusNota = corrected ? `Nota: ${item.score ?? '—'}` : 'Pendente (sem correção)';
      const sentAt = formatDateBR(item.createdAt);
      const correctedAt = corrected ? formatDateBR(item.updatedAt) : null;

      if (item.id === newestId) {
        li.style.border = '2px solid rgba(16,185,129,.35)';
        li.style.boxShadow = '0 10px 24px rgba(16,185,129,0.10)';
      } else {
        li.style.border = '1px solid rgba(15,23,42,0.12)';
      }

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '10px';
      left.style.minWidth = '0';

      const img = document.createElement('img');
      img.alt = 'Foto do aluno';
      img.width = 36;
      img.height = 36;
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.style.border = '1px solid rgba(15,23,42,0.15)';

      const dataUrl = localStorage.getItem(photoKeyStudent(item.studentId));
      const letter = (item.studentName || '?').trim().slice(0, 1).toUpperCase();
      img.src = dataUrl || placeholderAvatarDataUrl(letter);

      const text = document.createElement('div');
      text.style.minWidth = '0';

      const nameLine = document.createElement('div');
      nameLine.style.display = 'flex';
      nameLine.style.alignItems = 'center';
      nameLine.style.flexWrap = 'wrap';
      nameLine.style.gap = '6px';

      const strong = document.createElement('strong');
      strong.textContent = item.studentName || 'Aluno';
      nameLine.appendChild(strong);

      if (item.id === newestId) nameLine.appendChild(renderMaisRecenteBadge());

      const meta = document.createElement('div');
      meta.style.fontSize = '12px';
      meta.style.opacity = '0.85';
      meta.style.marginTop = '4px';
      meta.textContent = `${statusNota} • Enviada em: ${sentAt}${correctedAt ? ` • Corrigida em: ${correctedAt}` : ''}`;

      text.appendChild(nameLine);

      if (item.studentEmail) {
        const small = document.createElement('small');
        small.textContent = item.studentEmail;
        small.style.display = 'block';
        small.style.opacity = '0.8';
        small.style.marginTop = '2px';
        text.appendChild(small);
      }

      text.appendChild(meta);

      left.appendChild(img);
      left.appendChild(text);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.alignItems = 'center';
      actions.style.gap = '8px';

      const btn = document.createElement('button');
      btn.textContent = corrected ? 'Ver redação/feedback' : 'Corrigir';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();

        if (corrected) {
          window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(String(taskId))}&studentId=${encodeURIComponent(String(item.studentId))}`;
        } else {
          abrirCorrecao(item, li);
        }
      });

      actions.appendChild(btn);

      li.appendChild(left);
      li.appendChild(actions);

      li.addEventListener('click', () => {
        if (corrected) {
          window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(String(taskId))}&studentId=${encodeURIComponent(String(item.studentId))}`;
        } else {
          abrirCorrecao(item, li);
        }
      });

      essaysList.appendChild(li);

      // autoabrir se veio studentId (apenas pendente)
      if (focusStudentId && String(item.studentId) === String(focusStudentId) && !corrected) {
        abrirCorrecao(item, li);
      }
    }
  } catch (err) {
    console.error(err);
    essaysList.innerHTML = '<li>Erro ao carregar redações.</li>';
    notify('error', 'Erro', String(err?.message || 'Não foi possível carregar as redações.'));
  }
}

// -------------------- painel de correção --------------------
function moveCorrectionSectionBelow(li) {
  if (!correctionSection) return;

  try {
    // ancora abaixo do item selecionado
    li.insertAdjacentElement('afterend', correctionSection);
  } catch {
    // fallback: mantém onde está
  }
}

function restoreCorrectionSectionToOriginal() {
  if (!correctionSection || !initialCorrectionParent) return;

  try {
    if (initialCorrectionNextSibling && initialCorrectionParent.contains(initialCorrectionNextSibling)) {
      initialCorrectionParent.insertBefore(correctionSection, initialCorrectionNextSibling);
    } else {
      initialCorrectionParent.appendChild(correctionSection);
    }
  } catch {
    // ignora
  }
}

function fillRubricsFromEssay(essay) {
  if (c1Input) c1Input.value = essay?.c1 ?? '';
  if (c2Input) c2Input.value = essay?.c2 ?? '';
  if (c3Input) c3Input.value = essay?.c3 ?? '';
  if (c4Input) c4Input.value = essay?.c4 ?? '';
  if (c5Input) c5Input.value = essay?.c5 ?? '';
  updateTotalUI();
}

function updateTotalUI() {
  const totalObj = calcularTotal();
  if (!totalEl) return;

  if (!totalObj) {
    totalEl.textContent = '—';
    return;
  }
  totalEl.textContent = String(totalObj.total);
}

function calcularTotal() {
  // aceita campos vazios => inválido
  const v1 = parseComp(c1Input);
  const v2 = parseComp(c2Input);
  const v3 = parseComp(c3Input);
  const v4 = parseComp(c4Input);
  const v5 = parseComp(c5Input);

  if (v1 === null || v2 === null || v3 === null || v4 === null || v5 === null) return null;

  const total = v1 + v2 + v3 + v4 + v5;
  return { v1, v2, v3, v4, v5, total };
}

function parseComp(inputEl) {
  if (!inputEl) return null;
  const raw = String(inputEl.value || '').trim();
  if (!raw) return null;

  const n = Number(raw);
  if (Number.isNaN(n)) return null;

  // ENEM: 0..200
  if (n < 0 || n > 200) return null;

  // força inteiro (se quiser permitir 20/40 etc, continua ok)
  return Math.round(n);
}

function initRubricsUI() {
  const inputs = [c1Input, c2Input, c3Input, c4Input, c5Input].filter(Boolean);

  inputs.forEach((inp) => {
    inp.addEventListener('input', () => {
      // sanitiza “rápido” (não agressivo)
      const v = String(inp.value || '');
      if (v.length > 4) inp.value = v.slice(0, 4);
      updateTotalUI();
    });
  });

  if (feedbackInputEl) {
    // mantém parágrafos
    applyBoxStyle(feedbackInputEl);
  }
}

async function abrirCorrecao(item, anchorLi) {
  currentEssayId = String(item?.id || '').trim();
  currentAnchorLi = anchorLi || null;

  if (!currentEssayId) {
    notify('error', 'Erro', 'Não foi possível identificar a redação.');
    return;
  }

  // mostra / ancora painel
  if (correctionSection) {
    correctionSection.style.display = '';
    if (currentAnchorLi) moveCorrectionSectionBelow(currentAnchorLi);
    // evita clique “vazar” para a li
    correctionSection.addEventListener(
      'click',
      (e) => e.stopPropagation(),
      { passive: true }
    );
  }

  setStatus('Carregando redação...');

  try {
    // Garante dados completos (muitos endpoints /with-student já trazem content, mas não confio)
    let essayFull = item?._raw || item;

    const needFetch = !essayFull?.content || String(essayFull.content || '').trim().length === 0;
    if (needFetch) {
      essayFull = await fetchEssayById(currentEssayId);
    }

    // cabeçalho aluno
    if (studentNameEl) studentNameEl.textContent = item.studentName || 'Aluno';
    if (studentEmailEl) studentEmailEl.textContent = item.studentEmail || '—';

    if (sentAtEl) sentAtEl.textContent = formatDateBR(getSentAt(essayFull));
    if (correctedAtEl) {
      correctedAtEl.textContent = isCorrected(essayFull)
        ? formatDateBR(pickDate(essayFull, ['correctedAt', 'corrected_at', 'updatedAt', 'updated_at']))
        : '—';
    }

    // redação
    if (essayBoxEl) renderEssayForProfessor(essayBoxEl, essayFull?.content || '');

    // feedback
    if (feedbackInputEl) {
      const fb = String(essayFull?.feedback || '').replace(/\r\n/g, '\n');
      if ('value' in feedbackInputEl) feedbackInputEl.value = fb;
      else feedbackInputEl.textContent = fb;

      // preserva
      feedbackInputEl.style.setProperty('white-space', 'pre-wrap', 'important');
      feedbackInputEl.style.setProperty('line-height', '1.6', 'important');
      feedbackInputEl.style.setProperty('text-align', 'justify', 'important');
      feedbackInputEl.style.setProperty('overflow-wrap', 'anywhere', 'important');
      feedbackInputEl.style.setProperty('word-break', 'break-word', 'important');
    }

    // competências
    fillRubricsFromEssay(essayFull);

    setStatus('');
  } catch (e) {
    console.error(e);
    notify('error', 'Erro', String(e?.message || 'Não foi possível abrir a redação.'));
    setStatus('Erro ao abrir a redação.');
  }
}

function closeCorrection(silent = false) {
  currentEssayId = null;
  currentAnchorLi = null;
  setStatus('');

  if (correctionSection) {
    correctionSection.style.display = 'none';
    restoreCorrectionSectionToOriginal();
  }

  if (!silent) notify('info', 'Fechado', 'Painel de correção fechado.', 1200);
}

// fechar painel
if (closeBtn) {
  closeBtn.addEventListener('click', async () => {
    const dirty =
      String(feedbackInputEl?.value || feedbackInputEl?.textContent || '').trim().length > 0 ||
      !!calcularTotal();

    if (dirty && currentEssayId) {
      const ok = await confirmDialog({
        title: 'Fechar correção',
        message: 'Você tem alterações. Deseja fechar sem salvar?',
        okText: 'Fechar',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
    }

    closeCorrection(true);
  });
}

// salvar correção
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    if (!currentEssayId) {
      notify('warn', 'Seleção necessária', 'Selecione uma redação primeiro.');
      setStatus('Selecione uma redação primeiro.');
      return;
    }

    const feedback = String(feedbackInputEl?.value || feedbackInputEl?.textContent || '').trim();
    const totalObj = calcularTotal();

    if (!feedback) {
      notify('warn', 'Campo obrigatório', 'Escreva o feedback.');
      setStatus('Escreva o feedback.');
      return;
    }

    if (!totalObj) {
      notify('warn', 'Campos obrigatórios', 'Preencha todas as competências (0 a 200).');
      setStatus('Preencha todas as competências (0 a 200).');
      return;
    }

    setStatus('Salvando correção...');
    disable(saveBtn, true);

    try {
      const res = await authFetch(
        `${API_URL}/essays/${encodeURIComponent(currentEssayId)}/correct`,
        {
          method: 'POST',
          body: JSON.stringify({
            feedback,
            c1: totalObj.v1,
            c2: totalObj.v2,
            c3: totalObj.v3,
            c4: totalObj.v4,
            c5: totalObj.v5,
          }),
        },
        { redirectTo: 'login-professor.html' }
      );

      if (!res.ok) {
        const msg = await readErrorMessage(res, `HTTP ${res.status}`);
        throw new Error(msg);
      }

      notify('success', 'Correção salva', 'A correção foi salva com sucesso.');
      setStatus('Correção salva com sucesso!');

      closeCorrection(true);
      await carregarRedacoes();
    } catch (e) {
      console.error(e);
      notify('error', 'Erro', String(e?.message || 'Erro ao salvar correção.'));
      setStatus('Erro ao salvar correção.');
    } finally {
      disable(saveBtn, false);
    }
  });
}

// -------------------- INIT --------------------
(async () => {
  try {
    if (correctionSection) correctionSection.style.display = 'none';
    initRubricsUI();
    await carregarTemaDaTarefa();
    await carregarRedacoes();
  } catch (e) {
    console.error(e);
  }
})();
