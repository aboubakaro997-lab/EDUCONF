import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { authService, extractError } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Initialisation — vérifie le token au chargement ────────
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');

      if (token) {
        try {
          // Tente de récupérer l'utilisateur depuis le backend
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (err) {
          console.error('Session expirée ou invalide:', err);
          // ✅ Nettoyage complet (access_token + user)
          authService.logout();
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // ── Déconnexion ─────────────────────────────────────────────
  // useCallback pour stabiliser la référence (usage dans useEffect enfants)
  const logout = useCallback(() => {
    authService.logout(); // Nettoie localStorage + header Authorization
    setUser(null);
    setError(null);
  }, []);

  // ── Connexion ───────────────────────────────────────────────
  const login = useCallback(async (credentials) => {
    try {
      setError(null);

      // ✅ credentials = { username, password }
      await authService.login(credentials);

      // Récupère le profil complet depuis le backend
      const userData = await authService.getCurrentUser();
      setUser(userData);

      return { success: true };
    } catch (err) {
      // ✅ extractError gère : Pydantic, réseau, timeout, detail string/array
      const errorMessage = extractError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // ── Inscription ─────────────────────────────────────────────
  const register = useCallback(async (userData) => {
    try {
      setError(null);

      // 1. Créer le compte
      await authService.register(userData);

      // 2. Connexion automatique après inscription
      // ✅ On passe "username" et non "email"
      return await login({
        username: userData.username,
        password: userData.password,
      });

    } catch (err) {
      const errorMessage = extractError(err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [login]);

  // ── Mise à jour du profil ────────────────────────────────────
  const updateUser = useCallback((updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
    localStorage.setItem('user', JSON.stringify({ ...user, ...updatedData }));
  }, [user]);

  // ── Valeur du contexte ───────────────────────────────────────
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook personnalisé ────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

export default AuthContext;
