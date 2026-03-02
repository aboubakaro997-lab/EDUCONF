import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';

const Login = () => {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username) {
      newErrors.username = "Le nom d'utilisateur est requis";
    } else if (formData.username.length < 3) {
      newErrors.username = "Minimum 3 caractères requis";
    }
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Minimum 6 caractères requis';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    const result = await login(formData);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setErrors({ general: result.error });
    }
  };

  return (
    // ✅ FIX 1 — translate="no" sur le conteneur racine
    // Empêche Google Translate de modifier les nœuds texte de ce composant
    <div
      className="min-h-screen bg-ci-gradient flex items-center justify-center p-4"
      translate="no"
    >
      <Card className="max-w-md w-full" padding="lg">

        {/* ── Logo ── */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-ci border-4 border-ci-orange">
            <img
              src="/armoirie-ci.png"
              alt="Armoiries Côte d'Ivoire"
              className="w-20 h-20 object-contain"
            />
          </div>

          <h2 className="text-3xl font-bold text-ci-gray-800 mb-2">
            {/* ✅ FIX 2 — Chaque texte dans son propre <span> */}
            <span>Connexion</span>
          </h2>

          {/* ✅ FIX 3 — Emojis isolés dans des spans dédiés, jamais nus */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <span aria-hidden="true">🇨🇮</span>
            <p className="text-ci-gray-600">
              <span>Connectez-vous à EduConf CI</span>
            </p>
            <span aria-hidden="true">🇨🇮</span>
          </div>

          <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mt-3" />
        </div>

        {/* ── Erreur générale ─────────────────────────────────────
            ✅ FIX 4 — Toujours rendu, visibilité via CSS
            Évite l'apparition/disparition brutale d'un nœud DOM
            que React et le navigateur peuvent désynchroniser        */}
        <div
          className={`mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg transition-all duration-200 ${
            errors.general
              ? 'opacity-100 max-h-24'
              : 'opacity-0 max-h-0 overflow-hidden p-0 mb-0 border-0'
          }`}
          aria-live="polite"
        >
          <p className="text-red-700 text-sm">
            {/* ✅ FIX 5 — Jamais de texte conditionnel nu,
                toujours une string (vide si pas d'erreur) */}
            <span>{errors.general || ''}</span>
          </p>
        </div>

        {/* ── Formulaire ── */}
        <form onSubmit={handleSubmit} noValidate>

          <Input
            label="Nom d'utilisateur"
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="votre_nom_utilisateur"
            required
            error={errors.username}
            autoComplete="username"
            icon={
              <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />

          <Input
            label="Mot de passe"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            error={errors.password}
            autoComplete="current-password"
            icon={
              <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          <div className="mb-6 flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="mr-2 rounded border-ci-orange focus:ring-ci-orange"
              />
              <span className="text-sm text-ci-gray-600">
                <span>Se souvenir de moi</span>
              </span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-ci-orange hover:text-ci-orange-dark font-semibold"
            >
              <span>Mot de passe oublié ?</span>
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            disabled={loading}
          >
            {/* ✅ FIX 6 — Rendu conditionnel avec conteneur stable
                Le <span> parent est toujours là, seul le contenu change */}
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <span>🔐 Se connecter</span>
              )}
            </span>
          </Button>
        </form>

        {/* ── Liens ── */}
        <div className="mt-6 text-center">
          <p className="text-ci-gray-600">
            <span>Pas encore de compte ?</span>
            {' '}
            <Link
              to="/register"
              className="text-ci-green hover:text-ci-green-dark font-semibold"
            >
              <span>S'inscrire gratuitement</span>
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-ci-gray-500 hover:text-ci-orange">
            <span>← Retour à l'accueil</span>
          </Link>
        </div>

        {/* ── Footer ── */}
        <div className="mt-6 pt-4 border-t border-ci-gray-200 text-center">
          <p className="text-xs text-ci-gray-500">
            <span aria-hidden="true">🐘</span>
            <span> Fièrement Made in Côte d'Ivoire </span>
            <span aria-hidden="true">🐘</span>
          </p>
        </div>

      </Card>
    </div>
  );
};

export default Login;
