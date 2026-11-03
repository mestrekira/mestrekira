// js/ui-feedback.js

export function ensureFeedbackUI() {
  // Toast root
  if (!document.getElementById('toast-root')) {
    const toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    toastRoot.className = 'toast-root';
    toastRoot.setAttribute('aria-live', 'polite');
    toastRoot.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastRoot);
  }

  // Confirm modal
  if (!document.getElementById('confirm-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'confirm-overlay';
    overlay.hidden = true;

    overlay.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">Confirmar ação</h3>
        <p id="confirm-message">Tem certeza?</p>
        <div class="confirm-actions">
          <button id="confirm-cancel" class="btn-outline">Cancelar</button>
          <button id="confirm-ok" class="btn-danger">Confirmar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }
}

export function toast({ title = '', message = '', type = 'info', duration = 2200 } = {}) {
  ensureFeedbackUI();
  const root = document.getElementById('toast-root');
  if (!root) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div>
      ${title ? `<div class="title"></div>` : ''}
      ${message ? `<div class="msg"></div>` : ''}
    </div>
    <button class="close" aria-label="Fechar">×</button>
  `;

  if (title) el.querySelector('.title').textContent = title;
  if (message) el.querySelector('.msg').textContent = message;

  const closeBtn = el.querySelector('.close');
  closeBtn.addEventListener('click', () => remove());

  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  const t = setTimeout(remove, duration);

  function remove() {
    clearTimeout(t);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 180);
  }
}

export function confirmDialog({
  title = 'Confirmar ação',
  message = 'Tem certeza?',
  okText = 'Confirmar',
  cancelText = 'Cancelar',
} = {}) {
  ensureFeedbackUI();

  const overlay = document.getElementById('confirm-overlay');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  if (!overlay || !titleEl || !msgEl || !okBtn || !cancelBtn) return Promise.resolve(false);

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  overlay.hidden = false;

  return new Promise((resolve) => {
    const cleanup = (result) => {
      overlay.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = (e) => { if (e.target === overlay) cleanup(false); };
    const onKey = (e) => { if (e.key === 'Escape') cleanup(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}
