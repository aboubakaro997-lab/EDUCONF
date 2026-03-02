import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roomService } from '../services/api';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [error, setError] = useState(null);

  // Charger les salles au montage du composant
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await roomService.getRooms();
      setRooms(data);
    } catch (err) {
      setError('Erreur lors du chargement des salles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      alert('Veuillez entrer un nom de salle');
      return;
    }

    try {
      const newRoom = await roomService.createRoom({
        name: newRoomName,
        description: newRoomDescription || `Salle créée par ${user.full_name}`,
      });
      setRooms([newRoom, ...rooms]);
      setNewRoomName('');
      setNewRoomDescription('');
      setShowCreateModal(false);
    } catch (err) {
      alert('Erreur lors de la création de la salle');
      console.error(err);
    }
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette salle ?')) {
      return;
    }

    try {
      await roomService.deleteRoom(roomId);
      setRooms(rooms.filter(room => room.id !== roomId));
    } catch (err) {
      alert('Erreur lors de la suppression de la salle');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-ci-gray-50">
      {/* Header avec thème ivoirien */}
      <header className="bg-white shadow-md border-b-4 border-ci-orange">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
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
                <p className="text-sm text-ci-gray-600 flex items-center gap-1">
                  <span>🇨🇮</span>
                  Tableau de bord
                  <span>🇨🇮</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold text-ci-gray-800">{user?.full_name}</p>
                <p className="text-sm text-ci-gray-600">{user?.email}</p>
              </div>
              <Button variant="danger" onClick={logout}>
                🚪 Déconnexion
              </Button>
            </div>
          </div>
        </div>
        {/* Bandeau drapeau */}
        <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green"></div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Actions rapides */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-ci-gray-800">Mes Salles de Conférence</h2>
              <p className="text-ci-gray-600 mt-1">🐘 Gérez vos salles de visioconférence</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              ➕ Créer une salle
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Liste des salles */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-ci-orange"></div>
            <p className="mt-4 text-ci-gray-600">Chargement des salles...</p>
          </div>
        ) : rooms.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-32 h-32 bg-ci-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-16 h-16 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-ci-gray-800 mb-2">Aucune salle disponible</h3>
            <p className="text-ci-gray-600 mb-6">Créez votre première salle pour commencer vos conférences</p>
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              ➕ Créer ma première salle
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} hover className="flex flex-col border-t-4 border-ci-orange">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-ci-orange to-ci-green rounded-lg flex items-center justify-center shadow-ci">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-ci-gray-800">{room.name}</h3>
                      <p className="text-sm text-ci-gray-600">
                        👥 {room.participants_count || 0} participant(s)
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    room.is_active 
                      ? 'bg-ci-green/20 text-ci-green border border-ci-green' 
                      : 'bg-ci-gray-100 text-ci-gray-600 border border-ci-gray-300'
                  }`}>
                    {room.is_active ? '🟢 Active' : '⚪ Inactive'}
                  </span>
                </div>

                {room.description && (
                  <p className="text-sm text-ci-gray-600 mb-4 flex-grow">{room.description}</p>
                )}

                <div className="flex gap-2 mt-auto">
                  <Button 
                    fullWidth 
                    variant="primary"
                    onClick={() => handleJoinRoom(room.id)}
                  >
                    📹 Rejoindre
                  </Button>
                  {room.host_id === user?.id && (
                    <Button 
                      variant="danger"
                      onClick={() => handleDeleteRoom(room.id)}
                    >
                      🗑️
                    </Button>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-ci-gray-200 text-xs text-ci-gray-500">
                  📅 Créée le {new Date(room.created_at).toLocaleDateString('fr-FR')}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer avec fierté ivoirienne */}
      <footer className="mt-auto py-6 border-t border-ci-gray-200">
        <div className="container mx-auto px-4 text-center">
          <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mb-4 max-w-md mx-auto"></div>
          <p className="text-ci-gray-600 font-semibold">
            🐘 Fièrement Made in Côte d'Ivoire 🐘
          </p>
        </div>
      </footer>

      {/* Modal de création avec thème ivoirien */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full border-t-4 border-ci-orange">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-ci-orange to-ci-green rounded-full flex items-center justify-center">
                <span className="text-2xl">🎥</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-ci-gray-800">Créer une nouvelle salle</h3>
                <p className="text-sm text-ci-gray-600">🇨🇮 Conférence ivoirienne</p>
              </div>
            </div>

            <Input
              label="Nom de la salle"
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Ex: Cours de Mathématiques"
              required
              icon={
                <svg className="w-5 h-5 text-ci-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-ci-gray-700 mb-2">
                Description (optionnelle)
              </label>
              <textarea
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Décrivez le sujet de votre conférence..."
                rows="3"
                className="w-full px-4 py-2 border border-ci-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ci-orange focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                fullWidth
                onClick={() => {
                  setShowCreateModal(false);
                  setNewRoomName('');
                  setNewRoomDescription('');
                }}
              >
                ❌ Annuler
              </Button>
              <Button 
                variant="primary" 
                fullWidth
                onClick={handleCreateRoom}
              >
                ✅ Créer
              </Button>
            </div>

            {/* Bandeau drapeau dans le modal */}
            <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mt-6"></div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
