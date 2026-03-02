import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roomService, extractError } from '../services/api';
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

  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
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
        description: newRoomDescription || `Salle creee par ${user?.full_name || user?.username}`,
      });
      setRooms([newRoom, ...rooms]);
      setNewRoomName('');
      setNewRoomDescription('');
      setShowCreateModal(false);
    } catch (err) {
      alert('Erreur lors de la creation de la salle');
      console.error(err);
    }
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Veuillez entrer un code de salle');
      return;
    }

    try {
      setJoiningByCode(true);
      setError(null);
      const room = await roomService.joinRoomByCode(code);
      setJoinCode('');
      navigate(`/room/${room.id}`);
    } catch (err) {
      const message = extractError(err);
      const alreadyInRoom =
        typeof message === 'string' &&
        (message.toLowerCase().includes('deja dans cette salle') ||
          message.toLowerCase().includes('deja'));

      if (alreadyInRoom) {
        const existingRoom = rooms.find((r) => r.room_code === code);
        if (existingRoom) {
          navigate(`/room/${existingRoom.id}`);
          return;
        }
      }

      setError(message || 'Impossible de rejoindre cette salle');
      console.error(err);
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Etes-vous sur de vouloir supprimer cette salle ?')) {
      return;
    }

    try {
      await roomService.deleteRoom(roomId);
      setRooms(rooms.filter((room) => room.id !== roomId));
    } catch (err) {
      alert('Erreur lors de la suppression de la salle');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-ci-gray-50">
      <header className="bg-white shadow-md border-b-4 border-ci-orange">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border-2 border-ci-orange shadow-ci">
                <img src="/armoirie-ci.png" alt="Armoiries Cote d'Ivoire" className="w-12 h-12 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-ci-orange via-ci-green to-ci-orange bg-clip-text text-transparent">
                  EduConf CI
                </h1>
                <p className="text-sm text-ci-gray-600">Tableau de bord</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold text-ci-gray-800">{user?.full_name || user?.username}</p>
                <p className="text-sm text-ci-gray-600">{user?.email}</p>
              </div>
              <Button variant="danger" onClick={logout}>
                Deconnexion
              </Button>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green" />
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-ci-gray-800">Mes salles de conference</h2>
              <p className="text-ci-gray-600 mt-1">Gerez vos salles de visioconference</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              Creer une salle
            </Button>
          </div>

          <Card className="mb-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <Input
                  label="Rejoindre avec un code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: AB12CD"
                  maxLength={10}
                />
              </div>
              <Button variant="primary" onClick={handleJoinByCode} disabled={joiningByCode}>
                {joiningByCode ? 'Connexion...' : 'Rejoindre par code'}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-ci-orange" />
            <p className="mt-4 text-ci-gray-600">Chargement des salles...</p>
          </div>
        ) : rooms.length === 0 ? (
          <Card className="text-center py-12">
            <h3 className="text-xl font-bold text-ci-gray-800 mb-2">Aucune salle disponible</h3>
            <p className="text-ci-gray-600 mb-6">Creez votre premiere salle pour commencer</p>
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              Creer ma premiere salle
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} hover className="flex flex-col border-t-4 border-ci-orange">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-ci-gray-800">{room.name}</h3>
                    <p className="text-sm text-ci-gray-600">Code: {room.room_code}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      room.is_active
                        ? 'bg-ci-green/20 text-ci-green border border-ci-green'
                        : 'bg-ci-gray-100 text-ci-gray-600 border border-ci-gray-300'
                    }`}
                  >
                    {room.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {room.description && (
                  <p className="text-sm text-ci-gray-600 mb-4 flex-grow">{room.description}</p>
                )}

                <div className="flex gap-2 mt-auto">
                  <Button fullWidth variant="primary" onClick={() => handleJoinRoom(room.id)}>
                    Rejoindre
                  </Button>
                  {room.host_id === user?.id && (
                    <Button variant="danger" onClick={() => handleDeleteRoom(room.id)}>
                      Supprimer
                    </Button>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-ci-gray-200 text-xs text-ci-gray-500">
                  Creee le {new Date(room.created_at).toLocaleDateString('fr-FR')}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full border-t-4 border-ci-orange">
            <h3 className="text-2xl font-bold text-ci-gray-800 mb-4">Creer une nouvelle salle</h3>

            <Input
              label="Nom de la salle"
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Ex: Cours de Mathematiques"
              required
            />

            <div className="mb-4">
              <label className="block text-sm font-medium text-ci-gray-700 mb-2">Description (optionnelle)</label>
              <textarea
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Decrivez le sujet de votre conference..."
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
                Annuler
              </Button>
              <Button variant="primary" fullWidth onClick={handleCreateRoom}>
                Creer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
