// Única configuração pública: cole a origem HTTPS real da NOVA API após o deploy.
// Exemplo: https://nome-atribuido.vercel.app (sem /api e sem barra final).
// Nunca coloque senhas ou chaves de Resend/IA neste arquivo.
const configuredApiUrl = '';

export const API_URL = configuredApiUrl.trim().replace(/\/+$/, '');

export function validateApiUrl(value = API_URL) {
  if (!value) throw new Error('O ambiente de testes ainda não está conectado à API.');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      url.hostname === 'mestrekira-api.onrender.com') {
    throw new Error('Configure a origem HTTPS da nova API da plataforma de redação.');
  }
  return url.origin;
}

export async function apiFetch(input, options = {}) {
  const origin = validateApiUrl();
  const target = new URL(input, origin);
  if (target.origin !== origin) throw new Error('Requisição fora da API configurada.');
  return globalThis.fetch(target.href, options);
}
