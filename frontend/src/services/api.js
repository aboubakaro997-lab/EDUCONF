import axios from 'axios';

// ============================================================
//  CONFIGURATION DE BASE
// ============================================================
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const TIMEOUT        = 15000; // 15s
const MAX_RETRY      = 2;     // tentatives max sur erreur réseau
const RETRY_DELAY_MS = 800;   // délai entre tentatives

// ============================================================
//  INSTANCE AXIOS PRINCIPALE
// ============================================================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: TIMEOUT,
});

// ============================================================
//  HELPERS
// ============================================================

/** Pause en ms */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Stockage tokens */
const TokenStorage = {
  getAccess:  ()      => localStorage.getItem('access_token'),
  setAccess:  (token) => localStorage.setItem('access_token', token),
  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },
};

/** Redirige vers /login proprement */
const redirectToLogin = () => {
  TokenStorage.clear();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

// ============================================================
//  INTERCEPTEUR REQUEST — injecte le JWT
// ============================================================
api.interceptors.request.use(
  (config) => {
    const token = TokenStorage.getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Timestamp pour mesurer la latence (dev)
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
//  INTERCEPTEUR RESPONSE — gestion 401 / retry réseau
// ============================================================
api.interceptors.response.use(

  // ── Succès ──
  (response) => {
    if (process.env.NODE_ENV === 'development' && response.config.metadata) {
      const ms = Date.now() - response.config.metadata.startTime;
      console.debug(
        `✅ [${response.config.method?.toUpperCase()}] ${response.config.url} — ${ms}ms`
      );
    }
    return response;
  },

  // ── Erreur ──
  async (error) => {
    const originalRequest = error.config;

    // ── 1. Erreur réseau / timeout → retry automatique ──
    if (
      (!error.response || error.code === 'ECONNABORTED') &&
      !originalRequest._retry &&
      (originalRequest._retryCount || 0) < MAX_RETRY
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      await sleep(RETRY_DELAY_MS * originalRequest._retryCount);
      console.warn(
        `🔄 Retry ${originalRequest._retryCount}/${MAX_RETRY} — ${originalRequest.url}`
      );
      return api(originalRequest);
    }

    // ── 2. Token expiré (401) → déconnexion directe ──
    //    (pas de refresh token dans ce backend)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // ── 3. 403 Forbidden ──
    if (error.response?.status === 403) {
      console.error('🚫 Accès refusé — permissions insuffisantes');
    }

    // ── 4. 500+ Erreur serveur ──
    if (error.response?.status >= 500) {
      console.error('💥 Erreur serveur:', error.response?.data);
    }

    // ── Log dev ──
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `❌ [${error.config?.method?.toUpperCase()}] ${error.config?.url}`,
        error.response?.status,
        error.response?.data
      );
    }

    return Promise.reject(error);
  }
);

// ============================================================
//  HELPER : Extraction message d'erreur
// ============================================================
export const extractError = (error) => {
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) {
      // Erreurs de validation Pydantic
      return detail.map((e) => e.msg).join(', ');
    }
    return detail;
  }
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message === 'Network Error')
    return 'Erreur réseau. Vérifiez votre connexion.';
  if (error?.code === 'ECONNABORTED')
    return "Délai d'attente dépassé. Réessayez.";
  return error?.message || 'Une erreur inattendue est survenue';
};

// ============================================================
//  SERVICE AUTHENTIFICATION
// ============================================================
export const authService = {

  /** Inscription → POST /api/register */
  register: async (userData) => {
    const response = await api.post('/register', {
      username:  userData.username,
      email:     userData.email,
      password:  userData.password,
      full_name: userData.full_name,
    });
    return response.data;
  },

  /** Connexion → POST /api/login (OAuth2 Password Flow) */
  login: async (credentials) => {
    const formData = new URLSearchParams();
    // ⚠️ Le backend FastAPI OAuth2 attend "username" (pas "email")
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await api.post('/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = response.data;
    if (access_token) TokenStorage.setAccess(access_token);

    return response.data;
  },

  /** Profil utilisateur courant → GET /api/me */
  getCurrentUser: async () => {
    const response = await api.get('/me');
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  /** Déconnexion locale (pas de route logout dans ce backend) */
  logout: () => {
    TokenStorage.clear();
    delete api.defaults.headers.common.Authorization;
  },

  /** Vérifie si l'utilisateur est connecté localement */
  isAuthenticated: () => !!TokenStorage.getAccess(),

  /** Récupère l'utilisateur depuis le cache local */
  getCachedUser: () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

// ============================================================
//  SERVICE SALLES
// ============================================================
export const roomService = {

  /** Créer une salle → POST /api/rooms/ */
  createRoom: async (roomData) => {
    const response = await api.post('/rooms/', {
      name:             roomData.name,
      description:      roomData.description      || '',
      room_type:        roomData.room_type         || 'meeting',
      max_participants: roomData.max_participants  || 10,
      is_private:       roomData.is_private        || false,
    });
    return response.data;
  },

  /** Lister toutes les salles → GET /api/rooms/ */
  getRooms: async (params = {}) => {
    const response = await api.get('/rooms/', { params });
    return response.data;
  },

  /** Obtenir une salle par ID → GET /api/rooms/:id */
  getRoom: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  /** Rejoindre une salle → POST /api/rooms/:id/join */
  joinRoom: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/join`);
    return response.data;
  },

  /** Rejoindre une salle via code → POST /api/rooms/join/:code */
  joinRoomByCode: async (roomCode) => {
    const response = await api.post(`/rooms/join/${roomCode}`);
    return response.data;
  },

  /** Quitter une salle → POST /api/rooms/:id/leave */
  leaveRoom: async (roomId) => {
    const response = await api.post(`/rooms/${roomId}/leave`);
    return response.data;
  },

  /** Mettre à jour une salle → PATCH /api/rooms/:id */
  updateRoom: async (roomId, data) => {
    const response = await api.patch(`/rooms/${roomId}`, data);
    return response.data;
  },

  /** Supprimer une salle → DELETE /api/rooms/:id */
  deleteRoom: async (roomId) => {
    const response = await api.delete(`/rooms/${roomId}`);
    return response.data;
  },

  /** Participants d'une salle → GET /api/rooms/:id/participants */
  getRoomParticipants: async (roomId) => {
    const response = await api.get(`/rooms/${roomId}/participants`);
    return response.data;
  },

  /** Mes salles → GET /api/rooms/my */
  getMyRooms: async () => {
    const response = await api.get('/rooms/my');
    return response.data;
  },
};

// ============================================================
//  SERVICE UTILISATEURS
// ============================================================
export const userService = {

  /** Lister les utilisateurs → GET /api/users/ */
  getUsers: async (params = {}) => {
    const response = await api.get('/users/', { params });
    return response.data;
  },

  /** Obtenir un utilisateur par ID → GET /api/users/:id */
  getUser: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  /** Rechercher des utilisateurs → GET /api/users/search?q= */
  searchUsers: async (query) => {
    const response = await api.get('/users/search', {
      params: { q: query },
    });
    return response.data;
  },
};

// ============================================================
//  SERVICE MESSAGES / CHAT
// ============================================================
export const messageService = {

  /** Historique → GET /api/rooms/:id/messages */
  getMessages: async (roomId, params = { skip: 0, limit: 50 }) => {
    const response = await api.get(`/rooms/${roomId}/messages`, { params });
    return response.data;
  },

  /** Envoyer un message → POST /api/rooms/:id/messages */
  sendMessage: async (roomId, content) => {
    const response = await api.post(`/rooms/${roomId}/messages`, { content });
    return response.data;
  },

  /** Supprimer un message → DELETE /api/rooms/:id/messages/:msgId */
  deleteMessage: async (roomId, messageId) => {
    const response = await api.delete(
      `/rooms/${roomId}/messages/${messageId}`
    );
    return response.data;
  },
};

// ============================================================
//  EXPORT PAR DÉFAUT
// ============================================================
export default api;
