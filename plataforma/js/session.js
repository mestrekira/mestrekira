import { API_URL, apiFetch } from './config.js';
import { storage } from './storage.js';

export async function revokeSession({ admin = false } = {}) {
  const key = admin ? 'mk_admin_token' : 'token';
  const token = storage.getItem(key);
  if (!token) return;
  // Revogação remota antes de limpar a cópia local. Na falta de rede, a saída
  // local ainda acontece; o prazo de expiração do backend continua valendo.
  try {
    await apiFetch(`${API_URL}${admin ? '/admin/auth/logout' : '/auth/logout'}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.warn('Não foi possível confirmar a revogação remota da sessão.');
  }
}
