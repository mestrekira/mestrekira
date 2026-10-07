export function initDictation({ textarea, onCommit, actions = [] }) {
  const start = document.getElementById('dictationStart');
  const stop = document.getElementById('dictationStop');
  const paragraph = document.getElementById('dictationParagraph');
  const status = document.getElementById('dictationStatus');
  const preview = document.getElementById('dictationPreview');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition || !window.isSecureContext) {
    start.disabled = true;
    status.textContent = 'Ditado indisponível neste navegador ou conexão. Use um navegador compatível em HTTPS, ou continue digitando.';
    return;
  }
  start.disabled = true; // Liberado após carregar tema e rascunho.
  let recognition = null;
  let cursor = 0;
  let previous = null;
  let lastError = '';
  const commit = text => {
    if (!text) return;
    textarea.setRangeText(text, cursor, cursor, 'end');
    cursor += text.length;
    onCommit(); // Sincroniza proteção anti-colagem antes do evento input.
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const finish = () => {
    if (!previous) return;
    textarea.readOnly = previous.readOnly;
    actions.forEach((button, i) => { if (button) button.disabled = previous.disabled[i]; });
    previous = null; recognition = null;
    start.disabled = false; stop.disabled = true; paragraph.disabled = true;
    preview.textContent = '';
    status.textContent = lastError || 'Ditado encerrado. Revise as palavras e acrescente a pontuação antes de enviar.';
    textarea.focus(); textarea.setSelectionRange(cursor, cursor);
  };
  start.addEventListener('click', () => {
    if (recognition || textarea.disabled || textarea.readOnly) return;
    cursor = textarea.selectionEnd;
    previous = { readOnly: textarea.readOnly, disabled: actions.map(button => button?.disabled) };
    textarea.readOnly = true;
    actions.forEach(button => { if (button) button.disabled = true; });
    start.disabled = true; stop.disabled = false; paragraph.disabled = false;
    lastError = '';
    recognition = new Recognition();
    recognition.lang = 'pt-BR'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => { status.textContent = 'Ouvindo… Fale sua redação. Pare o ditado para revisar e pontuar.'; };
    recognition.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          const before = textarea.value.slice(0, cursor);
          const after = textarea.value.slice(cursor);
          commit((before && !/\s$/.test(before) ? ' ' : '') + text + (after && !/^\s/.test(after) ? ' ' : ''));
        } else interim += text + ' ';
      }
      preview.textContent = interim;
    };
    recognition.onerror = event => {
      const messages = { 'not-allowed': 'Permita o uso do microfone para ditar.', 'service-not-allowed': 'O serviço de voz está bloqueado neste navegador.', 'audio-capture': 'Microfone não encontrado.', 'no-speech': 'Nenhuma fala detectada. Você pode iniciar novamente.', network: 'O reconhecimento de voz perdeu a conexão. O texto já transcrito foi mantido.' };
      lastError = messages[event.error] || 'O ditado foi interrompido. O texto já transcrito foi mantido.';
      status.textContent = lastError;
    };
    recognition.onend = finish;
    try { recognition.start(); } catch { lastError = 'Não foi possível iniciar o microfone.'; finish(); }
  });
  stop.addEventListener('click', () => { if (recognition) { status.textContent = 'Finalizando ditado…'; paragraph.disabled = true; recognition.stop(); } });
  paragraph.addEventListener('click', () => { if (recognition) commit('\n\n'); });
  window.addEventListener('pagehide', () => recognition?.abort());
  return { enable: () => { start.disabled = false; } };
}
