import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth }     from '../contexts/AuthContext';
import { roomService } from '../services/api';

// ── Hooks personnalisés ──
import useSocket  from '../hooks/useSocket';
import useWebRTC  from '../hooks/useWebRTC';
import useChat    from '../hooks/useChat';

// ── Composants ──
import VideoGrid from '../components/room/VideoGrid';
import Controls from '../components/room/Controls';
import ChatPanel from '../components/room/ChatPanel';


// ============================================================
//  SYSTÈME TOAST
// ============================================================
const TOAST_TYPES = {
  info:    { bg: 'bg-ci-gray-800',   border: 'border-ci-gray-600',   icon: 'ℹ️' },
  success: { bg: 'bg-green-900/80',  border: 'border-green-700/50',  icon: '✅' },
  warning: { bg: 'bg-orange-900/80', border: 'border-ci-orange/50',  icon: '⚠️' },
  hand:    { bg: 'bg-ci-orange/90',  border: 'border-orange-400/30', icon: '✋' },
  join:    { bg: 'bg-ci-green/20',   border: 'border-ci-green/40',   icon: '👋' },
  leave:   { bg: 'bg-red-900/30',    border: 'border-red-700/40',    icon: '🚪' },
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

const ToastContainer = ({ toasts, onRemove }) => (
  <div className="
    fixed top-4 left-1/2 -translate-x-1/2 z-[200]
    flex flex-col gap-2 pointer-events-none
    w-full max-w-xs px-4
  ">
    {toasts.map(toast => {
      const cfg = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
      return (
        <div
          key={toast.id}
          onClick={() => onRemove(toast.id)}
          className={`
            flex items-center gap-2.5
            ${cfg.bg} border ${cfg.border}
            backdrop-blur-md text-white text-sm font-medium
            px-4 py-2.5 rounded-xl shadow-xl
            pointer-events-auto cursor-pointer w-full
          `}
        >
          <span className="text-base flex-shrink-0">{cfg.icon}</span>
          <span className="flex-1 leading-tight text-xs">{toast.message}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
            className="text-white/50 hover:text-white text-xs ml-1 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      );
    })}
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Écran de chargement
// ============================================================
const LoadingScreen = ({ message = 'Chargement...' }) => (
  <div className="min-h-screen bg-ci-gray-950 flex flex-col items-center justify-center gap-6">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green" />
    <div className="flex flex-col items-center gap-4">
      <div className="text-6xl animate-bounce select-none">🐘</div>
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 border-4 border-ci-gray-700 rounded-full" />
        <div className="absolute inset-0 border-4 border-t-ci-orange rounded-full animate-spin" />
      </div>
      <p className="text-white font-semibold text-lg tracking-wide">{message}</p>
      <p className="text-ci-gray-500 text-sm">
        EduConf CI — Plateforme éducative ivoirienne
      </p>
    </div>
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Écran d'erreur
// ============================================================
const ErrorScreen = ({ message, onBack }) => (
  <div className="min-h-screen bg-ci-gray-950 flex flex-col items-center justify-center gap-6 px-4">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green" />
    <div className="bg-ci-gray-900 border border-red-800/50 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-white text-xl font-bold mb-2">Erreur de connexion</h2>
      <p className="text-red-400 text-sm mb-6">{message}</p>
      <button
        onClick={onBack}
        className="
          w-full py-3 rounded-xl bg-ci-orange hover:bg-orange-600
          text-white font-bold text-sm
          transition-all duration-200 active:scale-95
        "
      >
        ← Retour au tableau de bord
      </button>
    </div>
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Alerte média (caméra/micro)
// ============================================================
const MediaAlert = ({ message, onDismiss }) => (
  <div className="
    fixed top-16 left-1/2 -translate-x-1/2 z-[150]
    bg-orange-900/90 border border-ci-orange/50
    backdrop-blur-md text-white text-sm
    px-4 py-3 rounded-xl shadow-xl
    flex items-center gap-3 max-w-sm w-full mx-4
  ">
    <span className="text-lg flex-shrink-0">⚠️</span>
    <span className="flex-1 text-xs">{message}</span>
    <button
      onClick={onDismiss}
      className="
        text-orange-300 hover:text-white
        transition-colors text-lg leading-none flex-shrink-0
      "
    >
      ×
    </button>
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Alerte réseau hors ligne
// ============================================================
const OfflineAlert = () => (
  <div className="
    fixed top-0 left-0 right-0 z-[300]
    bg-red-600 text-white text-xs font-bold
    text-center py-2 px-4
    flex items-center justify-center gap-2
  ">
    <span className="w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0" />
    Connexion internet perdue — Tentative de reconnexion...
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Badge statut socket
// ============================================================
const SocketStatusBadge = ({ connected, reconnecting }) => {
  if (reconnecting) {
    return (
      <span className="
        inline-flex items-center gap-1.5 text-xs px-3 py-1.5
        rounded-full border font-medium
        bg-orange-900/30 border-ci-orange/40 text-ci-orange
      ">
        <div className="
          w-3 h-3 border-2 border-ci-orange
          border-t-transparent rounded-full animate-spin
        " />
        Reconnexion...
      </span>
    );
  }

  return (
    <span className={`
      inline-flex items-center gap-1.5 text-xs px-3 py-1.5
      rounded-full border font-medium transition-all duration-300
      ${connected
        ? 'bg-green-900/30 border-green-700/40 text-green-400'
        : 'bg-red-900/30 border-red-700/40 text-red-400'
      }
    `}>
      <span className={`
        w-1.5 h-1.5 rounded-full flex-shrink-0
        ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}
      `} />
      {connected ? 'Connecté' : 'Déconnecté'}
    </span>
  );
};

// ============================================================
//  SOUS-COMPOSANT : Item Participant
// ============================================================
const ParticipantItem = ({ name, isLocal, audio, video }) => {
  const initials = useMemo(() =>
    (name || '?')
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
    [name]
  );

  return (
    <div className="
      flex items-center gap-3 px-3 py-2.5
      rounded-xl hover:bg-ci-gray-800 transition-colors
    ">
      {/* Avatar */}
      <div className="
        w-9 h-9 rounded-full flex-shrink-0
        bg-gradient-to-br from-ci-orange to-orange-700
        flex items-center justify-center
        text-white text-xs font-bold
        border-2 border-ci-gray-700
      ">
        {initials}
      </div>

      {/* Nom */}
      <div className="flex-1 min-w-0">
        <p className="
          text-white text-sm font-medium
          truncate flex items-center gap-1.5 flex-wrap
        ">
          {name}
          {isLocal && (
            <span className="
              text-[10px] bg-ci-green/20 text-ci-green
              px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0
            ">
              Vous
            </span>
          )}
        </p>
      </div>

      {/* Icônes état */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          className={`text-xs ${audio ? 'text-green-400' : 'text-red-400'}`}
          title={audio ? 'Micro actif' : 'Micro coupé'}
        >
          {audio ? '🎤' : '🔇'}
        </span>
        <span
          className={`text-xs ${video ? 'text-green-400' : 'text-red-400'}`}
          title={video ? 'Caméra active' : 'Caméra coupée'}
        >
          {video ? '📷' : '📵'}
        </span>
      </div>
    </div>
  );
};

// ============================================================
//  SOUS-COMPOSANT : Panneau Participants INLINE ✅
// ============================================================
const ParticipantsPanel = ({
  participants,
  localUser,
  isAudioEnabled,
  isVideoEnabled,
  onClose,
}) => (
  <div className="
    w-72 flex-shrink-0 border-l border-ci-gray-700
    bg-ci-gray-900 flex flex-col shadow-2xl
    transition-all duration-300
  ">
    {/* Header */}
    <div className="
      flex items-center justify-between
      px-4 py-3 flex-shrink-0
      border-b border-ci-gray-700/60
    ">
      <div className="flex items-center gap-2.5">
        <div className="
          w-8 h-8 rounded-xl
          bg-ci-green/20 border border-ci-green/30
          flex items-center justify-center text-base
        ">
          👥
        </div>
        <div>
          <h3 className="text-white font-bold text-sm leading-tight">
            Participants
          </h3>
          <p className="text-ci-gray-500 text-[10px]">
            {(participants?.length || 0) + 1} connecté(s)
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="
          w-8 h-8 rounded-lg flex items-center justify-center
          text-ci-gray-400 hover:text-white
          hover:bg-ci-gray-700 transition-all text-base
        "
        title="Fermer"
        aria-label="Fermer le panneau participants"
      >
        ✕
      </button>
    </div>

    {/* Bandeau drapeau 🇨🇮 */}
    <div className="h-0.5 bg-gradient-to-r from-ci-orange via-white to-ci-green flex-shrink-0" />

    {/* Liste scrollable */}
    <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
      {/* Soi-même en premier */}
      <ParticipantItem
        name={localUser?.full_name || localUser?.username || 'Vous'}
        isLocal={true}
        audio={isAudioEnabled}
        video={isVideoEnabled}
      />
      {/* Autres participants */}
      {(participants || []).map((p) => (
        <ParticipantItem
          key={p.sid || p.userId || p.id}
          name={p.userName || p.full_name || 'Participant'}
          isLocal={false}
          audio={p.audio !== false}
          video={p.video !== false}
        />
      ))}
    </div>

    {/* Footer */}
    <div className="px-4 py-3 border-t border-ci-gray-700/60 flex-shrink-0">
      <p className="text-ci-gray-600 text-[10px] text-center">
        🔒 Salle sécurisée — EduConf CI
      </p>
    </div>
  </div>
);

// ============================================================
//  COMPOSANT PRINCIPAL — Room
// ============================================================
const Room = () => {
  const { roomId: roomKey } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  // ── États locaux ──
  const [room,                setRoom]                = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [initStep,            setInitStep]            = useState('Chargement de la salle...');
  const [error,               setError]               = useState(null);
  const [isHandRaised,        setIsHandRaised]        = useState(false);
  const [isChatOpen,          setIsChatOpen]          = useState(false);
  const [isParticipantsOpen,  setIsParticipantsOpen]  = useState(false);
  const [mediaAlertDismissed, setMediaAlertDismissed] = useState(false);
  const [isOffline,           setIsOffline]           = useState(!navigator.onLine);
  const [isReconnecting,      setIsReconnecting]      = useState(false);
  const [sessionStartedAt,    setSessionStartedAt]    = useState(null);
  const [attendanceLoading,   setAttendanceLoading]   = useState(false);

  // ── Refs ──
  const hasJoinedRef = useRef(false);
  const abortRef     = useRef(null);

  // ── Toast ──
  const { toasts, addToast, removeToast } = useToast();

  // ============================================================
  //  1. HOOK SOCKET
  // ============================================================
  const { socket } = useSocket(localStorage.getItem('access_token'));
  const activeRoomId = useMemo(
    () => (room?.id ? String(room.id) : String(roomKey || '')),
    [room?.id, roomKey]
  );

  // ============================================================
  //  2. HOOK WEBRTC
  // ============================================================
  const {
    localStream,
    remoteStreams,
    participants,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    mediaError,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC(socket, activeRoomId, user?.full_name || user?.username, user?.id);

  // ============================================================
  //  3. HOOK CHAT
  // ============================================================
  const {
    messages,
    unreadCount,
    typingText,
    isLoading:        isChatLoading,
    chatError,
    groupedMessages,
    messagesEndRef,
    inputRef,
    sendMessage,
    deleteMessage,
    retryMessage,
    toggleChat,
    handleInputChange,
    formatTime,
  } = useChat(socket, activeRoomId, user);

  // ============================================================
  //  VALEURS MÉMORISÉES
  // ============================================================
  const participantsCount = useMemo(
    () => (participants?.length || 0) + 1,
    [participants]
  );

  const userInitials = useMemo(
    () =>
      (user?.full_name || user?.username || 'U')
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    [user]
  );

  const roomTypeLabel = useMemo(() => {
    const labels = {
      course:  '📚 Cours',
      meeting: '🤝 Réunion',
      webinar: '🎓 Webinaire',
    };
    return room?.room_type
      ? (labels[room.room_type] || '🏫 Salle')
      : null;
  }, [room?.room_type]);

  const isHost = useMemo(
    () => room?.host_id === user?.id,
    [room?.host_id, user?.id]
  );

  // ============================================================
  //  SURVEILLANCE RÉSEAU
  // ============================================================
  useEffect(() => {
    const onOnline  = () => {
      setIsOffline(false);
      addToast('Connexion internet rétablie', 'success');
    };
    const onOffline = () => {
      setIsOffline(true);
      addToast('Connexion internet perdue', 'warning');
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [addToast]);

  // ============================================================
  //  4. CHARGEMENT DE LA SALLE
  // ============================================================
  useEffect(() => {
    abortRef.current = new AbortController();
    loadRoom(abortRef.current.signal);

    return () => {
      abortRef.current?.abort();
      if (hasJoinedRef.current) leaveRoom();
    };
  }, [roomKey]);

  const loadRoom = async (signal) => {
    try {
      setLoading(true);
      setError(null);

      const normalizedKey = String(roomKey || '').trim();
      if (!normalizedKey) {
        throw new Error('Lien de salle invalide');
      }

      setInitStep("Verification du lien d'invitation...");
      let joinedRoom;
      try {
        joinedRoom = await roomService.joinRoomByCode(normalizedKey.toUpperCase());
      } catch (codeError) {
        if (!/^\d+$/.test(normalizedKey)) {
          throw codeError;
        }
        joinedRoom = await roomService.joinRoom(Number(normalizedKey));
      }
      if (signal?.aborted) return;
      setRoom(joinedRoom);

      setInitStep('Connexion au serveur...');
      if (signal?.aborted) return;

      setInitStep('Initialisation vidéo...');
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('❌ Erreur loadRoom:', err);
      setError(
        err?.response?.data?.detail || "Impossible d'acceder a cette salle. Utilisez un lien ou un code valide."
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // ============================================================
  //  5. CONNEXION SOCKET + JOIN WEBRTC
  // ============================================================
  const waitForSocket = useCallback((sock, timeout = 5000) =>
    new Promise((resolve, reject) => {
      if (sock.connected) return resolve();
      const timer = setTimeout(
        () => reject(new Error('Socket timeout')),
        timeout
      );
      sock.once('connect',       () => { clearTimeout(timer); resolve(); });
      sock.once('connect_error', (err) => { clearTimeout(timer); reject(err); });
    }),
    []
  );

  useEffect(() => {
    if (!room || !socket || hasJoinedRef.current) return;

    const initConnection = async () => {
      try {
        if (!socket.connected) socket.connect();
        await waitForSocket(socket, 5000);
        await joinRoom();
        hasJoinedRef.current = true;
        setSessionStartedAt(Date.now());
        addToast('Salle rejointe avec succès 🎉', 'success', 2500);
      } catch (err) {
        console.error('❌ Erreur connexion:', err);
        setError('Impossible de rejoindre la salle. Vérifiez votre connexion.');
      }
    };

    initConnection();
  }, [room, socket, waitForSocket, joinRoom, addToast]);

  // ============================================================
  //  6. ÉVÉNEMENTS SOCKET
  // ============================================================

  // Déconnexion / Reconnexion
  useEffect(() => {
    if (!socket) return;

    const onDisconnect = (reason) => {
      if (reason !== 'io client disconnect') {
        setIsReconnecting(true);
        addToast('Reconnexion en cours...', 'warning', 2000);
      }
    };

    const onReconnect = () => {
      setIsReconnecting(false);
      addToast('Reconnecté au serveur ✅', 'success', 2500);
    };

    socket.on('disconnect', onDisconnect);
    socket.on('connect',    onReconnect);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect',    onReconnect);
    };
  }, [socket, addToast]);

  // Participant rejoint / parti
  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ userName }) =>
      addToast(
        `${userName || 'Un participant'} a rejoint la salle`,
        'join',
        3000
      );

    const onUserLeft = ({ userName }) =>
      addToast(
        `${userName || 'Un participant'} a quitté la salle`,
        'leave',
        3000
      );

    socket.on('user_joined', onUserJoined);
    socket.on('user_left',   onUserLeft);

    return () => {
      socket.off('user_joined', onUserJoined);
      socket.off('user_left',   onUserLeft);
    };
  }, [socket, addToast]);

  // Main levée (autres participants)
  useEffect(() => {
    if (!socket) return;

    const onHandRaised = ({ userName, raised }) => {
      if (raised) {
        addToast(
          `${userName || 'Quelqu\'un'} a levé la main`,
          'hand',
          4000
        );
      }
    };

    socket.on('hand_raised', onHandRaised);
    return () => socket.off('hand_raised', onHandRaised);
  }, [socket, addToast]);

  useEffect(() => {
    if (!socket) return;

    const onHostForceMedia = ({ audio, video }) => {
      if (audio === false && video === false) {
        addToast('L hote a coupe les micros et les cameras', 'warning', 3000);
      } else if (audio === false) {
        addToast('L hote a coupe tous les micros', 'warning', 2500);
      } else if (video === false) {
        addToast('L hote a coupe toutes les cameras', 'warning', 2500);
      }
    };

    socket.on('host_force_media', onHostForceMedia);
    return () => socket.off('host_force_media', onHostForceMedia);
  }, [socket, addToast]);

  // ============================================================
  //  7. QUITTER LA SALLE
  // ============================================================
  const handleLeaveRoom = useCallback(async () => {
    try {
      leaveRoom();
      socket?.disconnect();
      if (room?.id) {
        await roomService.leaveRoom(room.id);
      }
    } catch (err) {
      console.error('Erreur sortie salle:', err);
    } finally {
      hasJoinedRef.current = false;
      setSessionStartedAt(null);
      navigate('/dashboard');
    }
  }, [leaveRoom, socket, room?.id, navigate]);

  // ============================================================
  //  8. TOGGLE CHAT — panneaux exclusifs ✅
  // ============================================================
  const handleToggleChat = useCallback(() => {
    const next = !isChatOpen;
    setIsChatOpen(next);
    if (next) setIsParticipantsOpen(false);
    toggleChat();
  }, [isChatOpen, toggleChat]);

  // ============================================================
  //  9. TOGGLE PARTICIPANTS — panneaux exclusifs ✅
  // ============================================================
  const handleToggleParticipants = useCallback(() => {
    const next = !isParticipantsOpen;
    setIsParticipantsOpen(next);
    if (next) setIsChatOpen(false);
  }, [isParticipantsOpen]);

  // ============================================================
  //  10. TOGGLE MAIN LEVÉE
  // ============================================================
  const handleToggleHand = useCallback(() => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    socket?.emit('hand_raised', {
      roomId: activeRoomId,
      userId:   socket.id,
      userName: user?.full_name || user?.username,
      raised:   next,
    });
    addToast(
      next ? 'Vous avez levé la main ✋' : 'Vous avez baissé la main',
      next ? 'hand' : 'info',
      2000
    );
  }, [isHandRaised, socket, activeRoomId, user, addToast]);

  const handleMuteAllMics = useCallback(() => {
    if (!isHost) return;
    socket?.emit('host_mute_all', { roomId: activeRoomId, action: 'audio' });
    addToast('Tous les micros des participants ont ete coupes', 'warning', 2500);
  }, [isHost, socket, activeRoomId, addToast]);

  const handleDisableAllCameras = useCallback(() => {
    if (!isHost) return;
    socket?.emit('host_mute_all', { roomId: activeRoomId, action: 'video' });
    addToast('Toutes les cameras des participants ont ete coupees', 'warning', 2500);
  }, [isHost, socket, activeRoomId, addToast]);

  const handleGenerateAttendance = useCallback(async () => {
    if (!isHost || !room?.id) return;

    try {
      setAttendanceLoading(true);
      const report = await roomService.getRoomAttendance(room.id);

      const rows = (report.participants || []).map((p) => [
        p.nom_prenom || '',
        p.temps_total_humain || '00:00:00',
        p.heure_entree ? new Date(p.heure_entree).toLocaleString('fr-FR') : '',
        p.heure_sortie ? new Date(p.heure_sortie).toLocaleString('fr-FR') : '',
      ]);
      const header = ['Nom Prenom', 'Temps cumule', 'Heure entree', 'Heure sortie'];
      const csv = [header, ...rows]
        .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `presence-${room.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      addToast('Liste de presence generee', 'success', 2500);
    } catch (err) {
      console.error(err);
      addToast("Impossible de generer la liste de presence", 'warning', 3000);
    } finally {
      setAttendanceLoading(false);
    }
  }, [isHost, room?.id, room?.name, addToast]);

  // ============================================================
  //  RENDU — Chargement / Erreur
  // ============================================================
  if (loading) return <LoadingScreen message={initStep} />;
  if (error || !room) return (
    <ErrorScreen
      message={error || 'Salle introuvable'}
      onBack={() => navigate('/dashboard')}
    />
  );

  // ============================================================
  //  RENDU PRINCIPAL
  // ============================================================
  return (
    <div className="min-h-screen bg-ci-gray-950 flex flex-col overflow-hidden">

      {/* ── Alerte hors ligne ── */}
      {isOffline && <OfflineAlert />}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Bandeau drapeau 🇨🇮 ── */}
      <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green flex-shrink-0" />

      {/* ── Alerte média ── */}
      {mediaError && !mediaAlertDismissed && (
        <MediaAlert
          message={mediaError}
          onDismiss={() => setMediaAlertDismissed(true)}
        />
      )}

      {/* ══════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════ */}
      <header className="
        bg-ci-gray-900/95 backdrop-blur-md
        border-b border-ci-gray-700/60
        px-4 py-3 flex-shrink-0 z-30
      ">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* ── Gauche : Logo + Infos salle ── */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="
              w-10 h-10 rounded-xl flex-shrink-0
              bg-gradient-to-br from-ci-orange to-orange-700
              flex items-center justify-center text-xl shadow-lg
              border border-orange-600/30 select-none
            ">
              🐘
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-bold text-base truncate">
                  {room.name}
                </h1>
                {/* Badge EN DIRECT */}
                <span className="
                  inline-flex items-center gap-1.5
                  bg-red-600/20 border border-red-600/40
                  text-red-400 text-[10px] font-bold
                  px-2 py-0.5 rounded-full flex-shrink-0
                ">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  EN DIRECT
                </span>
              </div>
              <p className="text-ci-gray-400 text-xs flex items-center gap-2 flex-wrap">
                <span>👥 {participantsCount} participant(s)</span>
                <span className="text-ci-gray-600">•</span>
                <span className="text-ci-orange font-medium truncate">
                  {user?.full_name || user?.username}
                </span>
              </p>
            </div>
          </div>

          {/* ── Centre : Statut Socket ── */}
          <div className="hidden md:flex items-center gap-2">
            <SocketStatusBadge
              connected={socket?.connected}
              reconnecting={isReconnecting}
            />
          </div>

          {/* ── Droite : Type salle + Avatar ── */}
          <div className="flex items-center gap-3">
            {roomTypeLabel && (
              <span className="
                hidden sm:inline-flex text-xs
                bg-ci-gray-800 border border-ci-gray-700
                text-ci-gray-400 px-2.5 py-1 rounded-lg
              ">
                {roomTypeLabel}
              </span>
            )}
                        {/* Avatar utilisateur */}
            <div
              className="
                w-9 h-9 rounded-full flex-shrink-0
                bg-gradient-to-br from-ci-green to-green-700
                flex items-center justify-center
                text-white text-sm font-bold
                border-2 border-ci-gray-700
                select-none
              "
              title={user?.full_name || user?.username}
            >
              {userInitials}
            </div>
          </div>
          {/* ── Fin Droite ── */}

        </div>
      </header>
      {/* ── Fin Header ── */}

      {/* ══════════════════════════════════════════════════
          ZONE PRINCIPALE  (vidéo + panneaux latéraux)
      ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ════════════════════════════
            ZONE VIDÉO
        ════════════════════════════ */}
        <main className="flex-1 relative overflow-hidden">

          {/* Grille vidéo — occupe tout l'espace moins la barre de contrôles */}
          <div className="absolute inset-0 pb-[72px]">
            <VideoGrid
              localStream={localStream}
              remoteStreams={remoteStreams}
              participants={participants}
              localUser={user}
              isLocalAudioOn={isAudioEnabled}
              isLocalVideoOn={isVideoEnabled}
              speakingPeers={[]}
            />
          </div>

          {/* ── Notification Main Levée flottante ── */}
          {isHandRaised && (
            <div className="
              absolute top-4 left-1/2 -translate-x-1/2 z-20
              bg-ci-orange/90 backdrop-blur-sm
              text-white text-sm font-bold
              px-4 py-2 rounded-full shadow-lg
              border border-orange-400/30
              flex items-center gap-2
              animate-bounce pointer-events-none select-none
            ">
              ✋ Vous avez levé la main
            </div>
          )}

          {/* ── Indicateur reconnexion Socket sur la vidéo ── */}
          {isReconnecting && (
            <div className="
              absolute bottom-20 left-1/2 -translate-x-1/2 z-20
              bg-ci-gray-900/90 backdrop-blur-sm
              border border-ci-orange/40
              text-ci-orange text-xs font-semibold
              px-4 py-2 rounded-full shadow-lg
              flex items-center gap-2
              pointer-events-none select-none
            ">
              <div className="
                w-3 h-3 border-2 border-ci-orange
                border-t-transparent rounded-full animate-spin
                flex-shrink-0
              " />
              Reconnexion au serveur...
            </div>
          )}

        </main>
        {/* ── Fin Zone Vidéo ── */}

        {/* ════════════════════════════
            PANNEAU PARTICIPANTS (inline, droite)
        ════════════════════════════ */}
        {isParticipantsOpen && (
          <ParticipantsPanel
            participants={participants}
            localUser={user}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            onClose={() => setIsParticipantsOpen(false)}
          />
        )}

        {/* ════════════════════════════
            PANNEAU CHAT (inline, droite)
        ════════════════════════════ */}
        {isChatOpen && (
          <div className="
            w-80 flex-shrink-0
            border-l border-ci-gray-700
            bg-ci-gray-900 flex flex-col
            shadow-2xl transition-all duration-300
          ">
            <ChatPanel
              messages={groupedMessages}
              unreadCount={unreadCount}
              typingText={typingText}
              isLoading={isChatLoading}
              chatError={chatError}
              messagesEndRef={messagesEndRef}
              inputRef={inputRef}
              currentUser={user}
              onSendMessage={sendMessage}
              onDeleteMessage={deleteMessage}
              onRetryMessage={retryMessage}
              onInputChange={handleInputChange}
              onClose={handleToggleChat}
              formatTime={formatTime}
            />
          </div>
        )}

      </div>
      {/* ── Fin Zone Principale ── */}

      {/* ══════════════════════════════════════════════════
          BARRE DE CONTRÔLES (fixe en bas, 72px)
      ══════════════════════════════════════════════════ */}
      <Controls
        // ── États médias ──
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}

        // ── États UI ──
        isChatOpen={isChatOpen}
        isHandRaised={isHandRaised}
        isParticipantsOpen={isParticipantsOpen}

        // ── Données ──
        participantsCount={participantsCount}
        unreadMessages={unreadCount}
        roomName={room.name}
        roomId={activeRoomId}
        sessionStartedAt={sessionStartedAt}
        isHost={isHost}
        attendanceLoading={attendanceLoading}

        // ── Callbacks ──
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleChat={handleToggleChat}
        onToggleHand={handleToggleHand}
        onToggleParticipants={handleToggleParticipants}
        onLeaveRoom={handleLeaveRoom}
        onMuteAllMics={handleMuteAllMics}
        onDisableAllCameras={handleDisableAllCameras}
        onGenerateAttendance={handleGenerateAttendance}
      />

    </div>
  );
  // ── Fin return ──
};

export default Room;

