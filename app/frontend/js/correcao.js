// correcao.js (final / alinhado ao HTML atual)
// - usa auth.js (notify + requireProfessorSession + authFetch + readErrorMessage)
// - lista redações enviadas para uma tarefa e permite corrigir (C1..C5 + feedback)
// - rubrics UI: botão "Ver ficha" abre/fecha painel por competência
// - preserva parágrafos na redação e no feedback
// - filtra redações de alunos removidos (se task tiver roomId)

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

// -------------------- ELEMENTOS (IDs reais do HTML) --------------------
const taskTitleEl = document.getElementById('taskTitle');
const taskMetaEl = document.getElementById('taskMeta');

const essaysList = document.getElementById('essaysList');

const correctionSection = document.getElementById('correctionSection');
const closeBtn = document.getElementById('closeCorrectionBtn');

const studentPhotoImg = document.getElementById('studentPhotoImg');
const studentNameEl = document.getElementById('studentName');
const studentEmailEl = document.getElementById('studentEmail');

const essayContentEl = document.getElementById('essayContent');

const c1Input = document.getElementById('c1');
const c2Input = document.getElementById('c2');
const c3Input = document.getElementById('c3');
const c4Input = document.getElementById('c4');
const c5Input = document.getElementById('c5');

const totalScoreEl = document.getElementById('totalScore');
const feedbackEl = document.getElementById('feedback');

const saveBtn = document.getElementById('saveCorrectionBtn');
const statusEl = document.getElementById('status');

if (!essaysList || !correctionSection || !essayContentEl || !saveBtn || !feedbackEl) {
  console.error('[correcao] HTML incompleto para correção.');
  notify('error', 'Erro', 'Página de correção incompleta (elementos essenciais ausentes).');
  throw new Error('HTML incompleto');
}

// -------------------- estado --------------------
let currentEssayId = null;
let currentAnchorLi = null;
let cachedActiveSet = null;

const initialCorrectionParent = correctionSection.parentElement;
const initialCorrectionNextSibling = correctionSection.nextSibling;

// -------------------- util: confirmação --------------------
async function confirmDialog(opts) {
  if (typeof uiConfirmDialog === 'function') {
    try {
      return await uiConfirmDialog(opts);
    } catch {}
  }
  return window.confirm(`${opts?.title ? opts.title + '\n\n' : ''}${opts?.message || 'Confirmar?'}`);
}

// -------------------- util: status --------------------
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

function disable(btn, value) {
  if (btn) btn.disabled = !!value;
}

// -------------------- util: unwrap --------------------
function unwrapResult(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.result)) return data.result;
    if (Array.isArray(data.data)) return data.data;
    if (data.result && typeof data.result === 'object') return data.result;
    if (data.data && typeof data.data === 'object') return data.data;
  }
  return data;
}

// -------------------- API helpers --------------------
async function apiJson(url, options) {
  const res = await authFetch(url, options || {}, { redirectTo: 'login-professor.html' });
  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

async function fetchTaskInfo(id) {
  try {
    const data = await apiJson(`${API_URL}/tasks/${encodeURIComponent(id)}`, { method: 'GET' });
    return unwrapResult(data) || null;
  } catch {
    return null;
  }
}

async function fetchActiveStudentsSet(roomId) {
  try {
    const data = await apiJson(`${API_URL}/rooms/${encodeURIComponent(roomId)}/students`, {
      method: 'GET',
    });
    const raw = unwrapResult(data);
    const arr = Array.isArray(raw) ? raw : [];
    const ids = arr
      .map((s) => String(s?.id || s?.studentId || '').trim())
      .filter(Boolean);
    return new Set(ids);
  } catch {
    return null;
  }
}

async function fetchEssaysWithStudent() {
  const data = await apiJson(
    `${API_URL}/essays/by-task/${encodeURIComponent(taskId)}/with-student`,
    { method: 'GET' }
  );
  const raw = unwrapResult(data);
  return Array.isArray(raw) ? raw : [];
}

async function fetchEssayById(essayId) {
  const data = await apiJson(`${API_URL}/essays/${encodeURIComponent(String(essayId))}`, {
    method: 'GET',
  });
  return unwrapResult(data) || null;
}

async function saveCorrection(essayId, payload) {
  const res = await authFetch(
    `${API_URL}/essays/${encodeURIComponent(String(essayId))}/correct`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { redirectTo: 'login-professor.html' }
  );

  if (!res.ok) throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  return res.json().catch(() => null);
}

// -------------------- datas + status --------------------
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

function getCorrectedAt(essay) {
  return pickDate(essay, ['correctedAt', 'corrected_at', 'updatedAt', 'updated_at']);
}

function isCorrected(essay) {
  const hasScore = essay?.score !== null && essay?.score !== undefined && !Number.isNaN(Number(essay.score));
  const hasFeedback = String(essay?.feedback || '').trim().length > 0;
  return hasScore || hasFeedback;
}

// -------------------- render “box” --------------------
function applyBoxStyle(el) {
  if (!el) return;
  el.style.setProperty('white-space', 'pre-wrap', 'important');
  el.style.setProperty('line-height', '1.6', 'important');
  el.style.setProperty('text-align', 'justify', 'important');
  el.style.setProperty('overflow-wrap', 'anywhere', 'important');
  el.style.setProperty('word-break', 'break-word', 'important');
  el.style.setProperty('padding', '14px 16px', 'important');
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

  const body = document.createElement('div');
  body.textContent = hasText ? g : 'Sem orientações adicionais.';
  body.style.whiteSpace = 'pre-wrap';
  body.style.textAlign = 'justify';
  el.appendChild(body);
}

// --- redação: compat __TITLE__ ---
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

// -------------------- fotos (usa localStorage do menu-perfil) --------------------
function photoKeyStudent(studentId) {
  return `mk_photo_student_${studentId}`;
}

function placeholderAvatarDataUrl(letter = '?') {
  const ch = String(letter || '?').slice(0, 1).toUpperCase();
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
        <rect width="100%" height="100%" fill="#eee"/>
        <text x="50%" y="55%" font-size="26" text-anchor="middle" fill="#888">${ch}</text>
      </svg>`
    )
  );
}

// -------------------- rubrics UI --------------------
const RUBRICS = {
  c1: [
    { score: 0, text: 'Fuga ao tema/ausência de texto ou domínio muito precário da norma.' },
    { score: 40, text: 'Muitos desvios de norma e comprometimento de leitura.' },
    { score: 80, text: 'Desvios frequentes, mas leitura possível.' },
    { score: 120, text: 'Alguns desvios pontuais.' },
    { score: 160, text: 'Poucos desvios; bom domínio.' },
    { score: 200, text: 'Excelente domínio; desvios raros.' },
  ],
  c2: [
    { score: 0, text: 'Fuga ao tema/ausência de repertório pertinente.' },
    { score: 40, text: 'Compreensão muito limitada; repertório inadequado.' },
    { score: 80, text: 'Compreensão parcial; repertório pouco produtivo.' },
    { score: 120, text: 'Compreensão adequada; repertório relevante.' },
    { score: 160, text: 'Boa compreensão; repertório bem articulado.' },
    { score: 200, text: 'Excelente; repertório muito bem mobilizado.' },
  ],
  c3: [
    { score: 0, text: 'Sem projeto/argumentação ou incoerente.' },
    { score: 40, text: 'Argumentação muito fraca; ideias soltas.' },
    { score: 80, text: 'Alguma progressão, mas pouco consistente.' },
    { score: 120, text: 'Projeto razoável; argumentação coerente.' },
    { score: 160, text: 'Boa organização; argumentos consistentes.' },
    { score: 200, text: 'Excelente progressão e consistência argumentativa.' },
  ],
  c4: [
    { score: 0, text: 'Falta de coesão; texto desconexo.' },
    { score: 40, text: 'Poucos mecanismos; rupturas frequentes.' },
    { score: 80, text: 'Coesão parcial; alguns problemas.' },
    { score: 120, text: 'Boa coesão; poucos problemas.' },
    { score: 160, text: 'Muito boa coesão; repertório coesivo variado.' },
    { score: 200, text: 'Excelente coesão e articulação.' },
  ],
  c5: [
    { score: 0, text: 'Sem proposta de intervenção ou incoerente.' },
    { score: 40, text: 'Proposta insuficiente; elementos faltando.' },
    { score: 80, text: 'Proposta simples; poucos detalhes.' },
    { score: 120, text: 'Proposta adequada com elementos principais.' },
    { score: 160, text: 'Boa proposta, detalhada.' },
    { score: 200, text: 'Excelente proposta, completa e articulada.' },
  ],
};

function initRubricsUI() {
  // total ao digitar
  [c1Input, c2Input, c3Input, c4Input, c5Input].forEach((inp) => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      // limita visualmente
      const v = String(inp.value || '');
      if (v.length > 4) inp.value = v.slice(0, 4);
      updateTotalUI();
    });
  });

  // feedback preserva parágrafos
  applyBoxStyle(feedbackEl);

  // botões "Ver ficha"
  const buttons = Array.from(document.querySelectorAll('.rubric-btn'));
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const comp = btn.getAttribute('data-comp');
      if (!comp) return;

      const panel = document.getElementById(`rubric-${comp}`);
      const hint = document.getElementById(`hint-${comp}`);
      if (!panel || !hint) return;

      const open = !panel.hidden;
      panel.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));

      if (open) {
        hint.textContent = '';
        panel.innerHTML = '';
        return;
      }

      // render do painel (seguro)
      panel.innerHTML = '';
      const items = RUBRICS[comp] || [];
      items.forEach((it) => {
        const line = document.createElement('div');
        line.style.padding = '6px 0';
        line.style.borderBottom = '1px solid rgba(15,23,42,0.10)';

        const strong = document.createElement('strong');
        strong.textContent = `${it.score}: `;
        line.appendChild(strong);

        const span = document.createElement('span');
        span.textContent = it.text;
        line.appendChild(span);

        // clicar sugere valor (não força)
        line.style.cursor = 'pointer';
        line.addEventListener('click', () => {
          const targetInput = document.getElementById(comp);
          if (targetInput) targetInput.value = String(it.score);
          hint.textContent = `Sugestão aplicada: ${it.score}`;
          updateTotalUI();
        });

        panel.appendChild(line);
      });

      hint.textContent = 'Clique em um nível para sugerir o valor.';
    });
  });
}

// -------------------- cálculo ENEM --------------------
function parseComp(inputEl) {
  const raw = String(inputEl?.value || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  if (n < 0 || n > 200) return null;
  return Math.round(n);
}

function calcularTotal() {
  const v1 = parseComp(c1Input);
  const v2 = parseComp(c2Input);
  const v3 = parseComp(c3Input);
  const v4 = parseComp(c4Input);
  const v5 = parseComp(c5Input);

  if (v1 === null || v2 === null || v3 === null || v4 === null || v5 === null) return null;
  return { v1, v2, v3, v4, v5, total: v1 + v2 + v3 + v4 + v5 };
}

function updateTotalUI() {
  const totalObj = calcularTotal();
  totalScoreEl.textContent = totalObj ? String(totalObj.total) : '—';
}

// -------------------- painel (ancorar abaixo do aluno) --------------------
function moveCorrectionSectionBelow(li) {
  try {
    li.insertAdjacentElement('afterend', correctionSection);
  } catch {}
}

function restoreCorrectionSection() {
  try {
    if (initialCorrectionNextSibling && initialCorrectionParent.contains(initialCorrectionNextSibling)) {
      initialCorrectionParent.insertBefore(correctionSection, initialCorrectionNextSibling);
    } else {
      initialCorrectionParent.appendChild(correctionSection);
    }
  } catch {}
}

function closeCorrection(silent = true) {
  currentEssayId = null;
  currentAnchorLi = null;
  setStatus('');
  correctionSection.style.display = 'none';
  restoreCorrectionSection();

  if (!silent) notify('info', 'Fechado', 'Painel de correção fechado.', 1200);
}

// -------------------- abrir correção --------------------
async function abrirCorrecao(item, anchorLi) {
  currentEssayId = String(item?.id || '').trim();
  currentAnchorLi = anchorLi || null;

  if (!currentEssayId) {
    notify('error', 'Erro', 'Não foi possível identificar a redação.');
    return;
  }

  correctionSection.style.display = '';
  if (currentAnchorLi) moveCorrectionSectionBelow(currentAnchorLi);

  setStatus('Carregando redação...');

  try {
    let full = item?._raw || item;

    // garante content/competências/feedback
    if (!full?.content) full = await fetchEssayById(currentEssayId);

    // aluno
    const name = String(item?.studentName || full?.studentName || full?.student?.name || 'Aluno').trim();
    const email = String(item?.studentEmail || full?.studentEmail || full?.student?.email || '—').trim();

    studentNameEl.textContent = name || 'Aluno';
    studentEmailEl.textContent = email || '—';

    const sid = String(item?.studentId || full?.studentId || full?.student?.id || '').trim();
    const dataUrl = sid ? localStorage.getItem(photoKeyStudent(sid)) : null;

    if (studentPhotoImg) {
      if (dataUrl) {
        studentPhotoImg.src = dataUrl;
        studentPhotoImg.style.display = '';
      } else {
        // mostra placeholder (opcional)
        studentPhotoImg.src = placeholderAvatarDataUrl((name || '?').slice(0, 1));
        studentPhotoImg.style.display = '';
      }
    }

    // redação
    renderEssayForProfessor(essayContentEl, full?.content || '');

    // competências
    c1Input.value = full?.c1 ?? '';
    c2Input.value = full?.c2 ?? '';
    c3Input.value = full?.c3 ?? '';
    c4Input.value = full?.c4 ?? '';
    c5Input.value = full?.c5 ?? '';
    updateTotalUI();

    // feedback
    feedbackEl.value = String(full?.feedback || '').replace(/\r\n/g, '\n');

    // se por algum motivo já estiver corrigida, redireciona
    if (isCorrected(full)) {
      notify('info', 'Já corrigida', 'Abrindo feedback do professor...');
      window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(String(taskId))}&studentId=${encodeURIComponent(String(sid))}`;
      return;
    }

    setStatus('');
  } catch (e) {
    console.error(e);
    notify('error', 'Erro', String(e?.message || 'Não foi possível abrir a redação.'));
    setStatus('Erro ao abrir a redação.');
  }
}

// -------------------- filtrar órfãos --------------------
function filterEssaysByActiveStudents(essays, activeSet) {
  if (!activeSet) return Array.isArray(essays) ? essays : [];
  return (Array.isArray(essays) ? essays : []).filter((e) => {
    const sid = String(e?.studentId || e?.student?.id || '').trim();
    return sid && activeSet.has(sid);
  });
}

// -------------------- lista --------------------
function normalizeEssayItem(e) {
  const id = String(e?.id || e?.essayId || '').trim();
  const studentId = String(e?.studentId || e?.student?.id || '').trim();
  const studentName = String(e?.studentName || e?.student?.name || e?.name || '').trim();
  const studentEmail = String(e?.studentEmail || e?.student?.email || e?.email || '').trim();

  return {
    id,
    studentId,
    studentName,
    studentEmail,
    score: e?.score ?? null,
    feedback: e?.feedback ?? '',
    content: e?.content ?? '',
    createdAt: getSentAt(e),
    correctedAt: getCorrectedAt(e),
    _raw: e,
  };
}

function sortEssaysForList(arr) {
  const list = Array.isArray(arr) ? [...arr] : [];
  list.sort((a, b) => {
    const ac = isCorrected(a) ? 1 : 0;
    const bc = isCorrected(b) ? 1 : 0;
    if (ac !== bc) return ac - bc;

    const at = toDateSafe(getSentAt(a))?.getTime?.() ?? -Infinity;
    const bt = toDateSafe(getSentAt(b))?.getTime?.() ?? -Infinity;
    if (at !== bt) return bt - at;

    return String(a.studentName || '').localeCompare(String(b.studentName || ''), 'pt-BR');
  });
  return list;
}

function makeMaisRecenteBadge() {
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

async function carregarRedacoes() {
  essaysList.innerHTML = '<li>Carregando redações...</li>';

  try {
    let raw = await fetchEssaysWithStudent();
    raw = filterEssaysByActiveStudents(raw, cachedActiveSet);

    const items = sortEssaysForList(raw.map(normalizeEssayItem).filter((x) => x.id && x.studentId));

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

      const corrected = isCorrected(item);
      const statusNota = corrected ? `Nota: ${item.score ?? '—'}` : 'Pendente (sem correção)';
      const sentAt = formatDateBR(item.createdAt);
      const correctedAt = corrected ? formatDateBR(item.correctedAt) : null;

      if (item.id === newestId) {
        li.style.border = '2px solid rgba(16,185,129,.35)';
        li.style.boxShadow = '0 10px 24px rgba(16,185,129,0.10)';
      }

      const left = document.createElement('div');
      left.style.minWidth = '0';

      const nameLine = document.createElement('div');
      nameLine.style.display = 'flex';
      nameLine.style.alignItems = 'center';
      nameLine.style.flexWrap = 'wrap';
      nameLine.style.gap = '6px';

      const strong = document.createElement('strong');
      strong.textContent = item.studentName || 'Aluno';
      nameLine.appendChild(strong);

      if (item.id === newestId) nameLine.appendChild(makeMaisRecenteBadge());

      const meta = document.createElement('div');
      meta.style.fontSize = '12px';
      meta.style.opacity = '0.85';
      meta.style.marginTop = '4px';
      meta.textContent = `${statusNota} • Enviada em: ${sentAt}${correctedAt ? ` • Corrigida em: ${correctedAt}` : ''}`;

      left.appendChild(nameLine);

      if (item.studentEmail) {
        const small = document.createElement('small');
        small.textContent = item.studentEmail;
        small.style.display = 'block';
        small.style.opacity = '0.8';
        small.style.marginTop = '2px';
        left.appendChild(small);
      }

      left.appendChild(meta);

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

      li.addEventListener('click', () => {
        if (corrected) {
          window.location.href = `feedback-professor.html?taskId=${encodeURIComponent(String(taskId))}&studentId=${encodeURIComponent(String(item.studentId))}`;
        } else {
          abrirCorrecao(item, li);
        }
      });

      li.appendChild(left);
      li.appendChild(btn);
      essaysList.appendChild(li);

      // autoabrir se veio ?studentId= (apenas pendente)
      if (focusStudentId && String(item.studentId) === String(focusStudentId) && !corrected) {
        abrirCorrecao(item, li);
      }
    }
  } catch (e) {
    console.error(e);
    essaysList.innerHTML = '<li>Erro ao carregar redações.</li>';
    notify('error', 'Erro', String(e?.message || 'Não foi possível carregar as redações.'));
  }
}

// -------------------- carregar tema/orientações --------------------
async function carregarTemaDaTarefa() {
  try {
    const task = await fetchTaskInfo(taskId);

    const titleRaw = String(task?.title || '').trim();
    if (taskTitleEl) taskTitleEl.textContent = titleRaw ? `Tema: ${titleRaw}` : 'Tema: —';

    if (taskMetaEl) renderGuidelinesInBox(taskMetaEl, 'Orientações', String(task?.guidelines || ''));

    const roomId = String(task?.roomId || task?.room?.id || '').trim();
    cachedActiveSet = roomId ? await fetchActiveStudentsSet(roomId) : null;
  } catch (e) {
    console.error(e);
    if (taskTitleEl) taskTitleEl.textContent = 'Tema: —';
    if (taskMetaEl) renderGuidelinesInBox(taskMetaEl, 'Orientações', '');
    cachedActiveSet = null;
  }
}

// -------------------- eventos: fechar --------------------
if (closeBtn) {
  closeBtn.addEventListener('click', async () => {
    const dirty =
      String(feedbackEl.value || '').trim().length > 0 ||
      String(c1Input.value || '').trim() ||
      String(c2Input.value || '').trim() ||
      String(c3Input.value || '').trim() ||
      String(c4Input.value || '').trim() ||
      String(c5Input.value || '').trim();

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

// -------------------- salvar correção --------------------
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    if (!currentEssayId) {
      notify('warn', 'Seleção necessária', 'Selecione uma redação primeiro.');
      setStatus('Selecione uma redação primeiro.');
      return;
    }

    const feedback = String(feedbackEl.value || '').trim();
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
      await saveCorrection(currentEssayId, {
        feedback,
        c1: totalObj.v1,
        c2: totalObj.v2,
        c3: totalObj.v3,
        c4: totalObj.v4,
        c5: totalObj.v5,
      });

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
    // box visual
    applyBoxStyle(essayContentEl);

    initRubricsUI();

    correctionSection.style.display = 'none';
    await carregarTemaDaTarefa();
    await carregarRedacoes();
    updateTotalUI();
  } catch (e) {
    console.error(e);
  }
})();
