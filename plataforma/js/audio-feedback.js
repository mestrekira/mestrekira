import { API_URL } from './config.js';
import { authFetch, readErrorMessage } from './auth.js';
import { confirmDialog } from './ui-feedback.js';

const MAX_SECONDS = 180;
const MAX_BYTES = 5 * 1024 * 1024;
const endpoint = id => `${API_URL}/writing/${encodeURIComponent(id)}/audio-feedback`;
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

async function request(url, options = {}) {
  const response = await authFetch(url, options);
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Não foi possível acessar o áudio.'));
  return response.json();
}

async function playSaved(id, player, isCurrent = () => true) {
  const data = await request(`${endpoint(id)}/playback`);
  if (!isCurrent()) return;
  const url = new URL(data.url);
  if (url.protocol !== 'https:' || url.hostname !== 'api.cloudinary.com' || !/^\/v1_1\/[^/]+\/video\/download$/.test(url.pathname)) throw new Error('Endereço de áudio inválido.');
  player.src = url.href;
  player.hidden = false;
  await player.play().catch(() => {}); // Controles permanecem disponíveis se o navegador exigir outro toque.
}

export function initAudioRecorder(root) {
  if (!root) return { load: async () => {}, reset() {}, isDirty: () => false, isBusy: () => false };
  root.innerHTML = `
    <h4>Orientação em áudio <span class="audio-optional">opcional</span></h4>
    <p class="audio-help">Salve primeiro o feedback escrito e as notas. Depois, se desejar, grave uma orientação de até 3 minutos. Ouça antes de enviar ao estudante.</p>
    <p data-audio-status role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="audio-actions">
      <button type="button" data-record disabled>Gravar orientação</button>
      <button type="button" data-pause class="secondary" hidden>Pausar</button>
      <button type="button" data-stop class="secondary" hidden>Encerrar gravação</button>
      <output data-clock aria-label="Tempo de gravação">00:00 / 03:00</output>
    </div>
    <div data-preview hidden>
      <p class="audio-help"><strong>Prévia — ainda não enviada.</strong> Confira a gravação antes de compartilhar.</p>
      <audio controls preload="metadata" data-preview-player aria-label="Prévia da orientação gravada"></audio>
      <div class="audio-actions">
        <button type="button" data-upload>Enviar áudio ao estudante</button>
        <button type="button" data-discard class="secondary">Descartar prévia</button>
      </div>
    </div>
    <div data-saved hidden>
      <p data-saved-info class="audio-help"></p>
      <div class="audio-actions">
        <button type="button" data-listen class="secondary">Ouvir áudio salvo</button>
        <button type="button" data-delete class="danger">Remover áudio salvo</button>
      </div>
      <audio controls preload="none" data-saved-player hidden aria-label="Orientação em áudio já enviada"></audio>
    </div>
    <p class="audio-help">O áudio complementa o texto. Uma gravação nova só substitui a anterior depois do envio. A prévia fica apenas nesta aba até você enviar ou descartar.</p>`;
  const $ = selector => root.querySelector(selector);
  const status = $('[data-audio-status]'), recordButton = $('[data-record]');
  const pauseButton = $('[data-pause]'), stopButton = $('[data-stop]');
  const preview = $('[data-preview-player]'), savedPlayer = $('[data-saved-player]');
  let id = '', epoch = 0, canRecord = false, metadata = null;
  let recorder = null, stream = null, blob = null, previewUrl = '', timer = null;
  let starting = false, stopping = false, sending = false, loading = false, elapsed = 0, startedAt = 0, paused = false;

  const active = () => Boolean(recorder && recorder.state !== 'inactive');
  const isBusy = () => starting || stopping || sending || active();
  const isDirty = () => Boolean(blob) || starting || stopping || active();
  function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
  function seconds() { return (elapsed + (active() && !paused ? performance.now() - startedAt : 0)) / 1000; }
  function update() {
    recordButton.disabled = !canRecord || isBusy() || loading || Boolean(blob);
    recordButton.textContent = starting ? 'Aguardando microfone…' : metadata?.audio ? 'Gravar nova orientação' : 'Gravar orientação';
    pauseButton.hidden = !active(); stopButton.hidden = !active();
    pauseButton.textContent = paused ? 'Retomar' : 'Pausar';
    $('[data-preview]').hidden = !blob;
    $('[data-upload]').disabled = sending;
    $('[data-upload]').textContent = sending ? 'Enviando áudio…' : metadata?.audio ? 'Substituir áudio enviado' : 'Enviar áudio ao estudante';
    $('[data-discard]').disabled = sending;
    $('[data-saved]').hidden = !metadata?.audio;
    $('[data-listen]').disabled = sending || starting || active();
    $('[data-delete]').disabled = sending || starting || active();
    $('[data-clock]').textContent = `${time(seconds())} / 03:00`;
    root.setAttribute('aria-busy', String(loading || starting || sending));
  }
  function clearPreview() {
    preview.pause(); preview.removeAttribute('src'); preview.load();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = ''; blob = null;
  }
  function stopTracks() { stream?.getTracks().forEach(track => track.stop()); stream = null; }
  function stop() {
    if (!active()) return;
    elapsed = seconds() * 1000;
    startedAt = 0;
    paused = true;
    stopping = true;
    clearInterval(timer); timer = null;
    recorder.stop();
    update();
  }
  function reset() {
    epoch++; clearInterval(timer); timer = null;
    if (active()) { recorder.onstop = null; recorder.ondataavailable = null; recorder.stop(); }
    stopTracks(); recorder = null; starting = false; stopping = false; sending = false; loading = false;
    elapsed = 0; startedAt = 0; paused = false; id = ''; canRecord = false; metadata = null;
    clearPreview(); savedPlayer.pause(); savedPlayer.removeAttribute('src'); savedPlayer.load(); savedPlayer.hidden = true;
    message('Selecione uma redação para consultar o áudio.'); update();
  }
  async function load(essayId) {
    reset(); id = String(essayId || ''); if (!id) return;
    const version = epoch; loading = true; message('Consultando orientação em áudio…'); update();
    try {
      const data = await request(endpoint(id));
      if (version !== epoch) return;
      metadata = data; canRecord = data.canRecord;
      if (data.audio) $('[data-saved-info]').textContent = `Áudio enviado ao estudante • ${time(data.audio.duration)}`;
      message(!data.configured ? 'O áudio ainda não está configurado no servidor. A correção escrita pode ser salva normalmente.' : canRecord ? 'Pronto para gravar. O microfone só será solicitado ao clicar no botão.' : 'Salve a correção escrita e as notas para habilitar a gravação.');
    } catch (error) { if (version === epoch) message(error.message === 'AUTH_401' ? 'Entre novamente para acessar o áudio.' : `Áudio indisponível: ${error.message}`, true); }
    finally { if (version === epoch) { loading = false; update(); } }
  }
  recordButton.addEventListener('click', async () => {
    if (!canRecord || isBusy() || blob) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      message('Este navegador não permite gravar aqui. Use um navegador atualizado com HTTPS. O feedback escrito continua disponível.', true); return;
    }
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { message('O navegador não oferece um formato de gravação compatível. Use Chrome, Edge, Firefox ou Safari atualizado.', true); return; }
    const version = epoch; starting = true; update();
    let acquired;
    savedPlayer.pause();
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (version !== epoch) { acquired.getTracks().forEach(t => t.stop()); return; }
      stream = acquired;
      recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 });
      const chunks = []; let size = 0, failed = false;
      recorder.ondataavailable = event => {
        if (version !== epoch || !event.data.size) return;
        size += event.data.size;
        if (size > MAX_BYTES) { failed = true; message('A gravação ultrapassou 5 MB. Grave uma orientação mais curta.', true); stop(); return; }
        chunks.push(event.data);
      };
      recorder.onerror = () => { if (version !== epoch) return; failed = true; message('A gravação foi interrompida. Tente novamente; o texto permanece salvo.', true); stop(); };
      recorder.onstop = () => {
        if (version !== epoch) return;
        clearInterval(timer); timer = null; stopTracks();
        if (!failed && chunks.length && size > 0) {
          blob = new Blob(chunks, { type: mime });
          previewUrl = URL.createObjectURL(blob); preview.src = previewUrl;
          message('Ouça a prévia. O estudante só receberá o áudio quando você clicar em enviar.');
        } else if (!failed) message('Nenhum áudio foi capturado. Verifique o microfone e tente novamente.', true);
        recorder = null; stopping = false; paused = false; update();
      };
      elapsed = 0; startedAt = performance.now(); paused = false;
      recorder.start(1000);
      timer = setInterval(() => { if (seconds() >= MAX_SECONDS) stop(); update(); }, 200);
      message('Gravando. Ao terminar, encerre para ouvir a prévia.');
    } catch (error) {
      acquired?.getTracks().forEach(t => t.stop());
      if (version === epoch) { recorder = null; stopTracks(); message(error.name === 'NotAllowedError' ? 'O microfone não foi autorizado. Permita o acesso no navegador para gravar, ou continue com o texto.' : 'Não foi possível abrir o microfone. Confira se ele está conectado e disponível.', true); }
    } finally { if (version === epoch) { starting = false; update(); } }
  });
  pauseButton.addEventListener('click', () => {
    if (!active()) return;
    if (paused) { recorder.resume(); startedAt = performance.now(); paused = false; message('Gravação retomada.'); }
    else { elapsed = seconds() * 1000; recorder.pause(); paused = true; message('Gravação pausada. Retome ou encerre para ouvir.'); }
    update();
  });
  stopButton.addEventListener('click', stop);
  $('[data-discard]').addEventListener('click', async () => {
    if (sending || !blob) return;
    const version = epoch;
    if (!await confirmDialog({ title: 'Descartar prévia?', message: 'Esta gravação ainda não foi enviada. O áudio salvo anteriormente será mantido.', okText: 'Descartar', cancelText: 'Manter prévia' })) return;
    if (version !== epoch || sending) return;
    clearPreview(); elapsed = 0; message('Prévia descartada. Você pode gravar novamente.'); update();
  });
  $('[data-upload]').addEventListener('click', async () => {
    if (!id || !blob || sending) return;
    const version = epoch; const target = id;
    if (metadata?.audio && !await confirmDialog({ title: 'Substituir áudio?', message: 'O áudio enviado anteriormente será substituído por esta gravação.', okText: 'Substituir', cancelText: 'Cancelar' })) return;
    if (version !== epoch || sending || !blob) return;
    sending = true; preview.pause(); message('Enviando áudio. Aguarde a confirmação antes de sair.'); update();
    try {
      const form = new FormData(); form.append('file', blob, 'orientacao'); form.append('revision', metadata?.audio?.revision || '');
      const data = await request(endpoint(target), { method: 'POST', body: form });
      if (version !== epoch) return;
      metadata = data; clearPreview(); elapsed = 0;
      $('[data-saved-info]').textContent = `Áudio enviado ao estudante • ${time(data.audio.duration)}`;
      savedPlayer.pause(); savedPlayer.removeAttribute('src'); savedPlayer.load(); savedPlayer.hidden = true;
      message('Áudio enviado. Ele já pode ser ouvido pelo estudante junto ao feedback escrito.');
    } catch (error) { if (version === epoch) message(`Áudio não enviado: ${error.message} A prévia foi preservada nesta aba.`, true); }
    finally { if (version === epoch) { sending = false; update(); } }
  });
  $('[data-listen]').addEventListener('click', async () => {
    const version = epoch, target = id;
    try { await playSaved(target, savedPlayer, () => version === epoch && target === id); }
    catch { if (version === epoch) message('Não foi possível ouvir o áudio agora. Clique em ouvir para tentar novamente.', true); }
  });
  savedPlayer.addEventListener('error', () => { if (savedPlayer.hasAttribute('src')) message('A reprodução expirou ou falhou. Clique em “Ouvir áudio salvo” para renovar o acesso.', true); });
  $('[data-delete]').addEventListener('click', async () => {
    if (!id || !metadata?.audio || sending || active()) return;
    const version = epoch;
    if (!await confirmDialog({ title: 'Remover áudio?', message: 'O estudante deixará de ter acesso a esta orientação em áudio. O texto e as notas serão mantidos.', okText: 'Remover', cancelText: 'Cancelar' })) return;
    if (version !== epoch || sending) return;
    sending = true; update();
    try {
      await request(endpoint(id), { method: 'DELETE', body: JSON.stringify({ revision: metadata.audio.revision }) });
      if (version !== epoch) return;
      metadata.audio = null; savedPlayer.pause(); savedPlayer.removeAttribute('src'); savedPlayer.load(); savedPlayer.hidden = true;
      message('Áudio removido da correção. O texto e as notas foram mantidos.');
    } catch (error) { if (version === epoch) message(`Não foi possível remover: ${error.message}`, true); }
    finally { if (version === epoch) { sending = false; update(); } }
  });
  window.addEventListener('beforeunload', event => { if (isDirty() || sending) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', reset);
  reset();
  return { load, reset, isDirty, isBusy };
}

export async function initAudioPlayer(root, id) {
  if (!root || !id) return;
  root.innerHTML = '<h3>Orientação em áudio do professor</h3><p data-audio-status role="status" aria-live="polite">Consultando áudio…</p><button type="button" data-listen>Ouvir orientação</button><audio controls preload="none" hidden aria-label="Orientação em áudio do professor"></audio>';
  const status = root.querySelector('[data-audio-status]'), button = root.querySelector('button'), player = root.querySelector('audio');
  button.disabled = true;
  try {
    const data = await request(endpoint(id));
    if (!data.audio) { root.hidden = true; return; }
    status.textContent = `Duração: ${time(data.audio.duration)}. O áudio complementa o feedback escrito.`;
    button.disabled = false;
  } catch { status.textContent = 'Não foi possível consultar o áudio agora. Atualize a página para tentar novamente. O feedback escrito continua disponível.'; }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await playSaved(id, player); status.textContent = 'Use os controles para ouvir e pausar a orientação.'; }
    catch { status.textContent = 'Não foi possível ouvir agora. Tente novamente.'; }
    finally { button.disabled = false; }
  });
  player.addEventListener('error', () => { if (player.hasAttribute('src')) status.textContent = 'O acesso ao áudio expirou ou falhou. Clique em “Ouvir orientação” para tentar novamente.'; });
}

// Páginas de feedback usam um único ID; a correção com seleção chama load/reset explicitamente.
const standalone = document.querySelector('[data-audio-standalone]');
if (standalone) {
  const id = new URLSearchParams(location.search).get('essayId');
  if (id && standalone.dataset.audioStandalone === 'professor') initAudioRecorder(standalone).load(id);
  else if (id) initAudioPlayer(standalone, id);
}
