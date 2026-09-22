// ============================================================
// RUSH PERFORMANCE — API Client & Session Manager
// ============================================================

// Na web o caminho relativo resolve sozinho, porque o frontend e a
// API saem da mesma origem. Dentro do app nativo NAO: o webview
// roda em https://localhost (Capacitor) e '/api' apontaria para o
// proprio webview, que nao serve rota nenhuma.
//
// VITE_API_URL e definida no build que antecede o `cap sync`. A
// queda para '/api' preserva o comportamento da web intacto.
//
// O sufixo /api e acrescentado quando falta. Isso nao e adivinhacao:
// TODA rota deste servidor e montada sob /api (server/index.js), sem
// excecao. E evita o erro mais provavel de quem configura isso —
// escrever apenas o host e ver o app falhar em toda chamada, sem erro
// visivel na tela. O .env deste projeto ja trazia exatamente essa
// forma incompleta.
function baseDaApi(): string {
  const bruto = (import.meta.env.VITE_API_URL || '').trim();
  if (!bruto) return '/api';
  const semBarra = bruto.replace(/\/+$/, '');
  return /\/api$/.test(semBarra) ? semBarra : `${semBarra}/api`;
}

const API_BASE = baseDaApi();

function getToken() {
  return localStorage.getItem('rush_token');
}

function getRefreshToken() {
  return localStorage.getItem('rush_refresh');
}

function setAuth(data: any) {
  if (!data) return;
  const token = data.access_token || data.token;
  const refresh = data.refresh_token || data.refreshToken;
  if (token) localStorage.setItem('rush_token', token);
  if (refresh) localStorage.setItem('rush_refresh', refresh);
  if (data.user) localStorage.setItem('rush_user', JSON.stringify(data.user));
}

function clearAuth() {
  localStorage.removeItem('rush_token');
  localStorage.removeItem('rush_refresh');
  localStorage.removeItem('rush_user');
}

function getUser() {
  try {
    const raw = localStorage.getItem('rush_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Mutex promise deduplication for concurrent token refreshes
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });

        if (!res.ok) {
          clearAuth();
          return false;
        }

        const data = await res.json();
        const newToken = data.access_token || data.token;
        const newRefresh = data.refresh_token || data.refreshToken;

        if (newToken) localStorage.setItem('rush_token', newToken);
        if (newRefresh) localStorage.setItem('rush_refresh', newRefresh);
        return true;
      } catch (err) {
        clearAuth();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const isAuthEndpoint = path.startsWith('/auth/login') ||
                         path.startsWith('/auth/register') ||
                         path.startsWith('/auth/refresh');

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // For auth endpoints, don't attempt refresh and don't clear storage or reload page
    if (isAuthEndpoint) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Credenciais inválidas');
    }

    // Try refreshing access token with mutex deduplication
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new Error(err.error || 'Erro na requisição');
      }
      return retry.json();
    }

    clearAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro na requisição');
  }

  return res.json();
}

/**
 * Igual a `request`, mas devolve o corpo como texto — usado pela exportação
 * .GPX, que responde XML e não JSON.
 */
async function requestText(path: string, options: RequestInit = {}): Promise<string> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw new Error('Sessão expirada');
    }
    headers['Authorization'] = `Bearer ${getToken()}`;
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro na requisição');
  }

  return res.text();
}

// Auth API
// Removidos daqui por nao terem nenhum chamador em todo o src/, e
// porque cada um ja tem quem faca o mesmo trabalho:
//   auth.me        -> users.me() faz a mesma requisicao
//   auth.refresh   -> tryRefresh() acima ja fala com /auth/refresh,
//                     e com deduplicacao de chamadas concorrentes
//   users.getUser  -> perfil publico vem de social.userProfile()
//   training.plans -> nenhuma tela lista o catalogo de planos; o plano
//                     do atleta vem de training.myPlan()
// As ROTAS continuam existindo no backend e cobertas por teste. Se
// alguma tela precisar de uma delas, o wrapper volta em uma linha.

export const auth = {
  login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data: any) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
};

export const authApi = auth;

// Users
export const users = {
  me: () => request('/users/me'),
  profile: () => request('/users/profile'),
  updateProfile: (data: any) => request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  objectives: (data: any) => request('/users/objectives', { method: 'PUT', body: JSON.stringify(data) }),
  settings: (data: any) => request('/users/settings', { method: 'PUT', body: JSON.stringify(data) }),
  privacy: (data: any) => request('/users/privacy', { method: 'PUT', body: JSON.stringify(data) }),
  fieldTest: (data: any) => request('/users/field-test', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (password: string) => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  privacyZone: () => request('/users/privacy-zone'),
  savePrivacyZone: (zone: any) => request('/users/privacy-zone', { method: 'PUT', body: JSON.stringify(zone) }),
  removePrivacyZone: () => request('/users/privacy-zone', { method: 'DELETE' }),
  devices: () => request('/users/devices'),
  registerDevice: (data: any) => request('/users/devices', { method: 'POST', body: JSON.stringify(data) }),
  removeDevice: (id: string) => request(`/users/devices/${id}`, { method: 'DELETE' }),
};

// HRV
export const hrv = {
  status: (date?: string) => request(`/hrv/status${date ? `?date=${date}` : ''}`),
  measure: (data: any) => request('/hrv/measurement', { method: 'POST', body: JSON.stringify(data) }),
  wellness: (data: any) => request('/hrv/wellness', { method: 'POST', body: JSON.stringify(data) }),
  history: (days = 30) => request(`/hrv/history?days=${days}`),
  vo2max: () => request('/hrv/vo2max'),
  zones: () => request('/hrv/zones'),
};

// Gear (Garagem de Tênis)
export const gear = {
  shoes: () => request('/gear/shoes'),
  createShoe: (data: any) => request('/gear/shoes', { method: 'POST', body: JSON.stringify(data) }),
  updateShoe: (id: string, data: any) => request(`/gear/shoes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  retireShoe: (id: string) => request(`/gear/shoes/${id}/retire`, { method: 'POST' }),
  reactivateShoe: (id: string) => request(`/gear/shoes/${id}/reactivate`, { method: 'POST' }),
  deleteShoe: (id: string) => request(`/gear/shoes/${id}`, { method: 'DELETE' }),
};

// Menstrual
export const menstrual = {
  getProfile: () => request('/menstrual/profile'),
  saveProfile: (data: any) => request('/menstrual/profile', { method: 'POST', body: JSON.stringify(data) }),
  today: (date?: string) => request(`/menstrual/today${date ? `?date=${date}` : ''}`),
  track: (data: any) => request('/menstrual/tracking', { method: 'POST', body: JSON.stringify(data) }),
};

// Training
export const training = {
  myPlan: () => request('/training/my-plan'),
  planDetails: (id: string) => request(`/training/plans/${id}`),
  generatePlan: (data: any) => request('/training/generate-plan', { method: 'POST', body: JSON.stringify(data) }),
};

// Activities

/** Filtros aceitos por `activities.list`. A janela de datas alimenta o calendário mensal do histórico. */
export interface ListaAtividadesOpcoes {
  limit?: number;
  type?: string;
  /** Data ISO inicial da janela. */
  from?: string;
  /** Data ISO final da janela. */
  to?: string;
}

export const activities = {
  list: (page = 1, options: ListaAtividadesOpcoes = {}) => {
    const params = new URLSearchParams({ page: String(page) });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.type) params.set('type', options.type);
    // Janela de datas (ISO) — usada pelo calendário mensal do histórico.
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    return request(`/activities?${params.toString()}`);
  },
  create: (data: any) => request('/activities', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request(`/activities/${id}`),
  update: (id: string, data: any) => request(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/activities/${id}`, { method: 'DELETE' }),
  stats: (days = 30) => request(`/activities/stats/summary?days=${days}`),
  records: () => request('/activities/records'),
  gpx: (id: string) => requestText(`/activities/${id}/gpx`),
  trim: (id: string, startSeconds: any, endSeconds: any) =>
    request(`/activities/${id}/trim`, {
      method: 'POST',
      body: JSON.stringify({ start_seconds: startSeconds, end_seconds: endSeconds }),
    }),
  undoTrim: (id: string) => request(`/activities/${id}/trim/undo`, { method: 'POST' }),
  trainingLoad: () => request('/activities/training-load'),
};

// Social
export const social = {
  feed: (scope = 'following', page = 1) => request(`/social/feed?scope=${scope}&page=${page}`),
  follow: (userId: string) => request(`/social/follow/${userId}`, { method: 'POST' }),
  unfollow: (userId: string) => request(`/social/follow/${userId}`, { method: 'DELETE' }),
  like: (activityId: string) => request(`/social/like/${activityId}`, { method: 'POST' }),
  comment: (activityId: string, content: any) => request(`/social/comment/${activityId}`, { method: 'POST', body: JSON.stringify({ content }) }),
  search: (q: string) => request(`/social/search?q=${q}`),
  followers: () => request('/social/followers'),
  following: () => request('/social/following'),
  userProfile: (userId: string) => request(`/social/user/${userId}/profile`),
  deleteComment: (commentId: string) => request(`/social/comment/${commentId}`, { method: 'DELETE' }),
};

// Challenges
export const challenges = {
  list: () => request('/challenges'),
  join: (id: string) => request(`/challenges/${id}/join`, { method: 'POST' }),
  leaderboard: (id: string) => request(`/challenges/${id}/leaderboard`),
  achievements: () => request('/challenges/achievements/my'),
};

// Notifications
export const notifications = {
  list: (page = 1, limit = 30) => request(`/notifications?page=${page}&limit=${limit}`),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  readAll: () => request('/notifications/read-all', { method: 'PUT' }),
  pushKey: () => request('/notifications/push/key'),
  pushSubscribe: (subscription: any) =>
    request('/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
  pushUnsubscribe: (endpoint: string) =>
    request('/notifications/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  pushTest: () => request('/notifications/push/test', { method: 'POST' }),
};

// Academies (Coach / Assessoria)
export const academies = {
  my: () => request('/academies/my'),
  dashboard: () => request('/academies/dashboard'),
  invite: (email: string) => request('/academies/invite', { method: 'POST', body: JSON.stringify({ email }) }),
  registerAthlete: (data: any) => request('/academies/register-athlete', { method: 'POST', body: JSON.stringify(data) }),
  athleteDetails: (id: string) => request(`/academies/athlete/${id}`),
  prescribe: (athleteId: string, data: any) => request(`/academies/athlete/${athleteId}/prescribe`, { method: 'POST', body: JSON.stringify(data) }),
  create: (data: any) => request('/academies', { method: 'POST', body: JSON.stringify(data) }),
};

// Subscriptions (RUSH PRO)
export const subscriptions = {
  status: () => request('/subscriptions/status'),
  startTrial: () => request('/subscriptions/start-trial', { method: 'POST' }),
  /**
   * A unica porta pela qual uma compra vira PRO. O `recibo` e o que a
   * loja devolveu: a transacao assinada no iOS, o token de compra no
   * Android. Quem decide se vale e o servidor, consultando a loja.
   */
  verificarCompra: (loja: 'apple' | 'google', recibo: string) =>
    request('/subscriptions/verificar-compra', {
      method: 'POST',
      body: JSON.stringify({ loja, recibo }),
    }),
  /** Quais lojas tem verificacao configurada no servidor. */
  lojas: () => request('/subscriptions/lojas'),
  cancel: () => request('/subscriptions/cancel', { method: 'POST' }),
};

export { setAuth, clearAuth, getUser, getToken, getRefreshToken, tryRefresh, request };
