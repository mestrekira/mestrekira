// Comportamentos compartilhados das páginas de acesso; sem credenciais ou chamadas à API.
for (const button of document.querySelectorAll('[data-password-target]')) {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordTarget);
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${input.dataset.passwordLabel || 'senha'}`);
  });
}

for (const form of document.querySelectorAll('[data-access-form]')) {
  const submit = form.querySelector('[data-access-submit]');
  if (!submit) continue;
  // Os módulos existentes enviam pelo clique. Impedir apenas a navegação nativa do form.
  form.addEventListener('submit', event => event.preventDefault());
  submit.addEventListener('click', event => {
    if (submit.disabled || !form.reportValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  const idleLabel = submit.textContent;
  new MutationObserver(() => {
    form.setAttribute('aria-busy', String(submit.disabled));
    submit.textContent = submit.disabled ? submit.dataset.pendingLabel : idleLabel;
  }).observe(submit, { attributes: true, attributeFilter: ['disabled'] });
}
