const API_BASE = 'https://mestrekira-api.onrender.com';

window.api = {
  BASE_URL: API_BASE,
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('login.html');
  },

  async logout() {
    const token = this.getToken();
    try {
      if (token) {
        const response = await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 401) {
          console.warn('Não foi possível confirmar o encerramento da sessão no servidor.');
        }
      }
    } catch (error) {
      console.warn('Sem conexão para encerrar a sessão no servidor.', error);
    } finally {
      this.clearSession();
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        if (!endpoint.includes('/auth/login')) {
          this.clearSession();
          return null;
        }
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Ocorreu um erro na requisição.');
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
