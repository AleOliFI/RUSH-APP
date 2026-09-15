// ============================================================
// RUSH PERFORMANCE — API Client & Session Manager
// ============================================================

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('rush_token');
}

function getRefreshToken() {
  return localStorage.getItem('rush_refresh');
}

function setAuth(data) {
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
let refreshPromise = null;

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

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
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
async function requestText(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
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
export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/users/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
};

export const authApi = auth;

// Users
export const users = {
  me: () => request('/users/me'),
  profile: () => request('/users/profile'),
  updateProfile: (data) => request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  objectives: (data) => request('/users/objectives', { method: 'PUT', body: JSON.stringify(data) }),
  settings: (data) => request('/users/settings', { method: 'PUT', body: JSON.stringify(data) }),
  privacy: (data) => request('/users/privacy', { method: 'PUT', body: JSON.stringify(data) }),
  getUser: (username) => request(`/users/${username}`),
  fieldTest: (data) => request('/users/field-test', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (password) => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  privacyZone: () => request('/users/privacy-zone'),
  savePrivacyZone: (zone) => request('/users/privacy-zone', { method: 'PUT', body: JSON.stringify(zone) }),
  removePrivacyZone: () => request('/users/privacy-zone', { method: 'DELETE' }),
  devices: () => request('/users/devices'),
  registerDevice: (data) => request('/users/devices', { method: 'POST', body: JSON.stringify(data) }),
  removeDevice: (id) => request(`/users/devices/${id}`, { method: 'DELETE' }),
};

// HRV
export const hrv = {
  status: (date) => request(`/hrv/status${date ? `?date=${date}` : ''}`),
  measure: (data) => request('/hrv/measurement', { method: 'POST', body: JSON.stringify(data) }),
  wellness: (data) => request('/hrv/wellness', { method: 'POST', body: JSON.stringify(data) }),
  history: (days = 30) => request(`/hrv/history?days=${days}`),
  vo2max: () => request('/hrv/vo2max'),
  zones: () => request('/hrv/zones'),
};

// Gear (Garagem de Tênis)
export const gear = {
  shoes: () => request('/gear/shoes'),
  createShoe: (data) => request('/gear/shoes', { method: 'POST', body: JSON.stringify(data) }),
  updateShoe: (id, data) => request(`/gear/shoes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  retireShoe: (id) => request(`/gear/shoes/${id}/retire`, { method: 'POST' }),
  reactivateShoe: (id) => request(`/gear/shoes/${id}/reactivate`, { method: 'POST' }),
  deleteShoe: (id) => request(`/gear/shoes/${id}`, { method: 'DELETE' }),
};

// Menstrual
export const menstrual = {
  getProfile: () => request('/menstrual/profile'),
  saveProfile: (data) => request('/menstrual/profile', { method: 'POST', body: JSON.stringify(data) }),
  today: (date) => request(`/menstrual/today${date ? `?date=${date}` : ''}`),
  track: (data) => request('/menstrual/tracking', { method: 'POST', body: JSON.stringify(data) }),
};

// Training
export const training = {
  myPlan: () => request('/training/my-plan'),
  plans: (params) => request(`/training/plans${params ? `?${new URLSearchParams(params)}` : ''}`),
  planDetails: (id) => request(`/training/plans/${id}`),
  generatePlan: (data) => request('/training/generate-plan', { method: 'POST', body: JSON.stringify(data) }),
};

// Activities
export const activities = {
  list: (page = 1, options = {}) => {
    const params = new URLSearchParams({ page: String(page) });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.type) params.set('type', options.type);
    // Janela de datas (ISO) — usada pelo calendário mensal do histórico.
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    return request(`/activities?${params.toString()}`);
  },
  create: (data) => request('/activities', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request(`/activities/${id}`),
  update: (id, data) => request(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/activities/${id}`, { method: 'DELETE' }),
  stats: (days = 30) => request(`/activities/stats/summary?days=${days}`),
  records: () => request('/activities/records'),
  gpx: (id) => requestText(`/activities/${id}/gpx`),
  trim: (id, startSeconds, endSeconds) =>
    request(`/activities/${id}/trim`, {
      method: 'POST',
      body: JSON.stringify({ start_seconds: startSeconds, end_seconds: endSeconds }),
    }),
  undoTrim: (id) => request(`/activities/${id}/trim/undo`, { method: 'POST' }),
  trainingLoad: () => request('/activities/training-load'),
};

// Social
export const social = {
  feed: (scope = 'following', page = 1) => request(`/social/feed?scope=${scope}&page=${page}`),
  follow: (userId) => request(`/social/follow/${userId}`, { method: 'POST' }),
  unfollow: (userId) => request(`/social/follow/${userId}`, { method: 'DELETE' }),
  like: (activityId) => request(`/social/like/${activityId}`, { method: 'POST' }),
  comment: (activityId, content) => request(`/social/comment/${activityId}`, { method: 'POST', body: JSON.stringify({ content }) }),
  search: (q) => request(`/social/search?q=${q}`),
  followers: () => request('/social/followers'),
  following: () => request('/social/following'),
  userProfile: (userId) => request(`/social/user/${userId}/profile`),
  deleteComment: (commentId) => request(`/social/comment/${commentId}`, { method: 'DELETE' }),
};

// Challenges
export const challenges = {
  list: () => request('/challenges'),
  join: (id) => request(`/challenges/${id}/join`, { method: 'POST' }),
  leaderboard: (id) => request(`/challenges/${id}/leaderboard`),
  achievements: () => request('/challenges/achievements/my'),
};

// Notifications
export const notifications = {
  list: (page = 1, limit = 30) => request(`/notifications?page=${page}&limit=${limit}`),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  readAll: () => request('/notifications/read-all', { method: 'PUT' }),
  pushKey: () => request('/notifications/push/key'),
  pushSubscribe: (subscription) =>
    request('/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
  pushUnsubscribe: (endpoint) =>
    request('/notifications/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  pushTest: () => request('/notifications/push/test', { method: 'POST' }),
};

// Academies (Coach / Assessoria)
export const academies = {
  my: () => request('/academies/my'),
  dashboard: () => request('/academies/dashboard'),
  invite: (email) => request('/academies/invite', { method: 'POST', body: JSON.stringify({ email }) }),
  registerAthlete: (data) => request('/academies/register-athlete', { method: 'POST', body: JSON.stringify(data) }),
  athleteDetails: (id) => request(`/academies/athlete/${id}`),
  prescribe: (athleteId, data) => request(`/academies/athlete/${athleteId}/prescribe`, { method: 'POST', body: JSON.stringify(data) }),
  create: (data) => request('/academies', { method: 'POST', body: JSON.stringify(data) }),
};

// Subscriptions (RUSH PRO)
export const subscriptions = {
  status: () => request('/subscriptions/status'),
  startTrial: () => request('/subscriptions/start-trial', { method: 'POST' }),
  activate: (planType = 'monthly', provider = 'in_app') => request('/subscriptions/activate', { method: 'POST', body: JSON.stringify({ plan_type: planType, provider }) }),
  cancel: () => request('/subscriptions/cancel', { method: 'POST' }),
};

export { setAuth, clearAuth, getUser, getToken, getRefreshToken, tryRefresh, request };
