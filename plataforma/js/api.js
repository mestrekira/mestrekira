import { API_URL, apiFetch } from './config.js';
export { API_URL } from './config.js';

export async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (data !== null) options.body = JSON.stringify(data);
  const response = await apiFetch(`${API_URL}${endpoint}`, options);
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || result?.error || `HTTP ${response.status}`);
  return result;
}
