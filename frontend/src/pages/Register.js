import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';

const Register = () => {
  const navigate    = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    username:   '',
    email:      '',
    password:   '',
    full_name:  '',     // ✅ Inclus pour correspondre au backend
    confirmPassword: '',
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.full_name || formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Nom complet requis (min 2 caractères)';
    }

    if (!formData.username || formData.username.trim().length < 3) {
      newErrors.username = "Nom d'utilisateur requis (min 3 caractères)";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = "Lettres, chiffres et _ uniquement";
    }

    if (!formData.email) {
      newErrors.email = "L'email est requis";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Format email invalide';
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Mot de passe requis (min 8 caractères)';
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    // ✅ On envoie exactement ce que le backend attend
    const result = await register({
      username:  formData.username.trim(),
      email:     formData.email.trim(),
      password:  formData.password,
      full_name: formData.full_name.trim(),
    });

    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setErrors({ general: result.error });
    }
  };

  return (
    <div
      className="min-h-screen bg-ci-gradient flex items-center justify-center p-4"
      translate="no"
    >
      <Card className="max-w-md w-full" padding="lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-ci border-4 border-ci-orange">
            <img
              src="/armoirie-ci.png"
              alt="Armoiries Côte d'Ivoire"
              className="w-20 h-20 object-contain"
            />
          </div>
          <h2 className="text-3xl font-bold text-ci-gray-800 mb-2">
            <span>Inscription</span>
          </h2>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span aria-hidden="true">🇨🇮</span>
            <p className="text-ci-gray-600">
              <span>Rejoignez EduConf CI</span>
            </p>
            <span aria-hidden="true">🇨🇮</span>
          </div>
          <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mt-3" />
        </div>

        {/* Erreur générale */}
        <div
          className={`mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg transition-all duration-200 ${
            errors.general
              ? 'opacity-100 max-h-24'
              : 'opacity-0 max-h-0 overflow-hidden p-0 mb-0 border-0'
          }`}
          aria-live="polite"
        >
          <p className="text-red-700 text-sm">
            <span>{errors.general || ''}</span>
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Nom complet */}
          <Input
            label="Nom complet"
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="Kouamé Jean Baptiste"
            required
            error={errors.full_name}
            autoComplete="name"
            icon={
              <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5.121 17.804A9 9 0 1112 21a9 9 0 01-6.879-3.196z" />
              </svg>
            }
          />

          {/* Nom d'utilisateur */}
          <Input
            label="Nom d'utilisateur"
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="kouame_jb"
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

          {/* Email */}
          <Input
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="kouame@email.com"
            required
            error={errors.email}
            autoComplete="email"
            icon={
              <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            }
          />

          {/* Mot de passe */}
          <Input
            label="Mot de passe"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            error={errors.password}
            autoComplete="new-password"
            icon={
              <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          {/* Confirmation */}
          <Input
            label="Confirmer le mot de passe"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            required
            error={errors.confirmPassword}
            autoComplete="new-password"
            icon={
              <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            disabled={loading}
            className="mt-2"
          >
            <span className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>Inscription en cours...</span>
                </>
              ) : (
                <span>✅ Créer mon compte</span>
              )}
            </span>
          </Button>
        </form>

        {/* Liens */}
        <div className="mt-6 text-center">
          <p className="text-ci-gray-600">
            <span>Déjà un compte ?</span>
            {' '}
            <Link to="/login" className="text-ci-orange hover:text-ci-orange-dark font-semibold">
              <span>Se connecter</span>
            </Link>
          </p>
        </div>
        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-ci-gray-500 hover:text-ci-orange">
            <span>← Retour à l'accueil</span>
          </Link>
        </div>
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

export default Register;
