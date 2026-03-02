import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/common/Button';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md border-b-2 border-ci-orange sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border-2 border-ci-orange shadow-ci">
              <img 
                src="/armoirie-ci.png" 
                alt="Armoiries Côte d'Ivoire" 
                className="w-12 h-12 object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-ci-orange via-ci-green to-ci-orange bg-clip-text text-transparent">
                EduConf CI
              </h1>
              <p className="text-xs text-ci-gray-600 flex items-center gap-1">
                <span>🇨🇮</span>
                100% Ivoirienne
                <span>🇨🇮</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {isAuthenticated ? (
              <Button 
                variant="primary" 
                onClick={() => navigate('/dashboard')}
              >
                📊 Tableau de bord
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/login')}
                >
                  Connexion
                </Button>
                <Button 
                  variant="primary"
                  onClick={() => navigate('/register')}
                >
                  Inscription
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Bandeau drapeau */}
        <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green"></div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          {/* Armoirie centrale */}
          <div className="text-center mb-12">
            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-ci-orange ring-4 ring-ci-orange/20">
              <img 
                src="/armoirie-ci.png" 
                alt="Armoiries de la Côte d'Ivoire" 
                className="w-32 h-32 object-contain"
              />
            </div>

            {/* Titre principal */}
            <h1 className="text-6xl font-bold text-ci-gray-900 mb-4">
              Bienvenue sur EduConf CI
            </h1>
            
            {/* Sous-titre ivoirien */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-1 w-16 bg-gradient-to-r from-ci-orange to-ci-green rounded-full"></div>
              <div className="flex items-center gap-2">
                <span className="text-4xl">🇨🇮</span>
                <p className="text-2xl text-ci-gray-700 font-semibold">
                  100% Made in Côte d'Ivoire
                </p>
                <span className="text-4xl">🇨🇮</span>
              </div>
              <div className="h-1 w-16 bg-gradient-to-l from-ci-orange to-ci-green rounded-full"></div>
            </div>

            {/* Description */}
            <p className="text-xl text-ci-gray-600 max-w-2xl mx-auto mb-8">
              La première plateforme de visioconférence éducative ivoirienne. 
              Connectez-vous, partagez vos connaissances et apprenez ensemble.
            </p>

            {/* Bandeau drapeau décoratif */}
            <div className="h-2 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full max-w-md mx-auto mb-10"></div>

            {/* Boutons d'action */}
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                size="lg" 
                variant="primary"
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
                className="shadow-ci"
              >
                {isAuthenticated ? '📊 Accéder au tableau de bord' : '🚀 Commencer maintenant'}
              </Button>
              <Button 
                size="lg" 
                variant="success"
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                className="shadow-ci-green"
              >
                📖 En savoir plus
              </Button>
            </div>
          </div>

          {/* Features Grid - Couleurs Ivoiriennes */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            {/* Feature 1 - Orange */}
            <div className="group">
              <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-ci-orange hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-ci-orange to-ci-orange-light rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-ci group-hover:scale-110 transition-transform">
                  <span className="text-4xl">🎥</span>
                </div>
                <h3 className="text-2xl font-bold text-ci-gray-800 mb-3 text-center">
                  Vidéo HD
                </h3>
                <p className="text-ci-gray-600 text-center leading-relaxed">
                  Qualité vidéo exceptionnelle pour vos cours en ligne. 
                  Partagez vos connaissances en haute définition.
                </p>
                <div className="h-1 bg-ci-orange rounded-full mt-6"></div>
              </div>
            </div>

            {/* Feature 2 - Blanc/Vert */}
            <div className="group">
              <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-ci-green hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-ci-green to-ci-green-light rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-ci-green group-hover:scale-110 transition-transform">
                  <span className="text-4xl">💬</span>
                </div>
                <h3 className="text-2xl font-bold text-ci-gray-800 mb-3 text-center">
                  Chat en temps réel
                </h3>
                <p className="text-ci-gray-600 text-center leading-relaxed">
                  Communiquez instantanément avec vos étudiants et collègues. 
                  Interaction fluide et réactive.
                </p>
                <div className="h-1 bg-ci-green rounded-full mt-6"></div>
              </div>
            </div>

            {/* Feature 3 - Orange/Vert Mix */}
            <div className="group">
              <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-ci-orange hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="w-20 h-20 bg-gradient-to-br from-ci-orange via-white to-ci-green rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform">
                  <span className="text-4xl">📊</span>
                </div>
                <h3 className="text-2xl font-bold text-ci-gray-800 mb-3 text-center">
                  Tableau blanc
                </h3>
                <p className="text-ci-gray-600 text-center leading-relaxed">
                  Partagez vos écrans et dessinez en direct. 
                  Collaboration visuelle en temps réel.
                </p>
                <div className="h-1 bg-gradient-to-r from-ci-orange to-ci-green rounded-full mt-6"></div>
              </div>
            </div>
          </div>

          {/* Section Avantages */}
          <div className="mt-24 bg-white rounded-3xl shadow-xl p-12 border-t-4 border-ci-orange">
            <h2 className="text-4xl font-bold text-center text-ci-gray-800 mb-12">
              Pourquoi choisir EduConf CI ? 🐘
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Avantage 1 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-ci-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h4 className="font-bold text-ci-gray-800 text-lg mb-2">100% Ivoirienne</h4>
                  <p className="text-ci-gray-600">
                    Conçue et développée en Côte d'Ivoire, pour les Ivoiriens et l'Afrique.
                  </p>
                </div>
              </div>

              {/* Avantage 2 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-ci-green rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🔒</span>
                </div>
                <div>
                  <h4 className="font-bold text-ci-gray-800 text-lg mb-2">Sécurisée</h4>
                  <p className="text-ci-gray-600">
                    Vos données sont protégées avec un chiffrement de bout en bout.
                  </p>
                </div>
              </div>

              {/* Avantage 3 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-ci-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h4 className="font-bold text-ci-gray-800 text-lg mb-2">Rapide et Performante</h4>
                  <p className="text-ci-gray-600">
                    Technologie WebRTC pour une latence minimale et une qualité optimale.
                  </p>
                </div>
              </div>

              {/* Avantage 4 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-ci-green rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎓</span>
                </div>
                <div>
                  <h4 className="font-bold text-ci-gray-800 text-lg mb-2">Éducation Accessible</h4>
                  <p className="text-ci-gray-600">
                    Démocratiser l'accès à l'éducation en ligne pour tous les Ivoiriens.
                  </p>
                </div>
              </div>
            </div>

            {/* Bandeau drapeau */}
            <div className="h-2 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mt-10"></div>
          </div>

          {/* Call to Action Final */}
          <div className="mt-20 text-center">
            <div className="bg-gradient-to-r from-ci-orange via-white to-ci-green p-1 rounded-2xl inline-block">
              <div className="bg-white px-12 py-8 rounded-xl">
                <h3 className="text-3xl font-bold text-ci-gray-800 mb-4">
                  Prêt à commencer ?
                </h3>
                <p className="text-ci-gray-600 mb-6">
                  Rejoignez des milliers d'enseignants et d'étudiants ivoiriens
                </p>
                <Button 
                  size="lg" 
                  variant="primary"
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
                  className="shadow-ci"
                >
                  {isAuthenticated ? '📊 Voir mon tableau de bord' : '🎯 Créer mon compte gratuit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t-4 border-ci-orange mt-20 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Colonne 1 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img 
                  src="/armoirie-ci.png" 
                  alt="Armoiries CI" 
                  className="w-10 h-10 object-contain"
                />
                <h4 className="font-bold text-ci-gray-800">EduConf CI</h4>
              </div>
              <p className="text-ci-gray-600 text-sm">
                La plateforme de visioconférence éducative 100% ivoirienne.
              </p>
            </div>

            {/* Colonne 2 */}
            <div>
              <h4 className="font-bold text-ci-gray-800 mb-4">Liens rapides</h4>
              <ul className="space-y-2 text-sm text-ci-gray-600">
                <li><a href="#" className="hover:text-ci-orange transition">À propos</a></li>
                <li><a href="#" className="hover:text-ci-orange transition">Contact</a></li>
                <li><a href="#" className="hover:text-ci-orange transition">Aide</a></li>
                <li><a href="#" className="hover:text-ci-orange transition">Blog</a></li>
              </ul>
            </div>

            {/* Colonne 3 */}
            <div>
              <h4 className="font-bold text-ci-gray-800 mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-ci-gray-600">
                <li><a href="#" className="hover:text-ci-orange transition">Conditions d'utilisation</a></li>
                <li><a href="#" className="hover:text-ci-orange transition">Politique de confidentialité</a></li>
                <li><a href="#" className="hover:text-ci-orange transition">Mentions légales</a></li>
              </ul>
            </div>
          </div>

          {/* Bandeau drapeau */}
          <div className="h-2 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mb-6"></div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-ci-gray-600 font-semibold flex items-center justify-center gap-2">
              <span>🐘</span>
              Fièrement Made in Côte d'Ivoire
              <span>🐘</span>
            </p>
            <p className="text-sm text-ci-gray-500 mt-2">
              © 2026 EduConf CI. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
