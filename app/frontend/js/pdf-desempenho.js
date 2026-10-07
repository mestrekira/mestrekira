import { API_URL } from './config.js';
import { authFetch, readErrorMessage } from './auth.js';
export function initPerformancePdf({ roomId, role }) {
  const button = document.getElementById('downloadRoomPdfBtn');
  const status = document.getElementById('roomPdfStatus');
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = 'Gerando PDF da sala…';
    try {
      const res = await authFetch(`${API_URL}/writing-reports/${role}?roomId=${encodeURIComponent(roomId)}`, {}, { redirectTo: role === 'school' ? 'login-escola.html' : 'login-professor.html' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Não foi possível gerar o PDF.'));
      if (!(res.headers.get('content-type') || '').includes('application/pdf')) throw new Error('O servidor não retornou um PDF válido.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `desempenho-${role === 'school' ? 'escola' : 'professor'}-${roomId}.pdf`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = 'PDF gerado. Confira os downloads do navegador.';
    } catch (error) { status.textContent = error.message || 'Erro ao gerar PDF.'; }
    finally { button.disabled = false; }
  });
}
