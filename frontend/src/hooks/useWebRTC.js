import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

const getIceServers = () => {
  const raw = process.env.REACT_APP_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('REACT_APP_ICE_SERVERS invalide, fallback STUN par defaut');
  }

  return DEFAULT_ICE_SERVERS;
};

const useWebRTC = (socket, roomId, userName, userId = null) => {
  const localStreamRef   = useRef(null);
  const screenStreamRef  = useRef(null);  // ✅ Ajout ref écran
  const peersRef         = useRef({});

  const [localStream,     setLocalStream]     = useState(null);
  const [remoteStreams,   setRemoteStreams]    = useState([]);
  const [isAudioEnabled,  setIsAudioEnabled]  = useState(true);
  const [isVideoEnabled,  setIsVideoEnabled]  = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants,    setParticipants]    = useState([]);
  const [mediaError,      setMediaError]      = useState(null);
  const iceServers = useRef(getIceServers());

  const normalizeParticipants = useCallback((list = []) => {
    if (!Array.isArray(list)) return [];

    const currentSocketId = socket?.id;
    const map = new Map();

    list.forEach((p) => {
      if (!p) return;
      if (currentSocketId && p.sid === currentSocketId) return;
      if (userId != null && p.userId != null && p.userId === userId) return;
      const key = p.userId != null ? `uid:${p.userId}` : `sid:${p.sid}`;
      if (!map.has(key)) map.set(key, p);
    });

    return Array.from(map.values());
  }, [socket?.id, userId]);

  const addTrackToPeers = useCallback((track) => {
    Object.values(peersRef.current).forEach((peer) => {
      try {
        const sender = peer._pc?.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else if (localStreamRef.current) {
          peer.addTrack(track, localStreamRef.current);
        }
      } catch (err) {
        console.warn(`⚠️ Impossible d'ajouter la piste ${track.kind}:`, err);
      }
    });
  }, []);

  // ============================================================
  //  1. INITIALISATION DU FLUX LOCAL
  // ============================================================
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setMediaError(null);
      console.log('📹 Flux local initialisé');
      return stream;

    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);

      // ── Fallback : audio seulement ──
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        setIsVideoEnabled(false);
        setMediaError('📵 Caméra non disponible — mode audio uniquement');
        console.warn('⚠️ Fallback audio seulement');
        return audioOnly;

      } catch (audioErr) {
        const msg = getMediaErrorMessage(audioErr);
        setMediaError(msg);
        console.error('❌ Erreur accès audio:', audioErr);
        return null;
      }
    }
  }, []);

  // ============================================================
  //  2. SUPPRIMER UN PEER  (déclaré AVANT createPeer)
  // ============================================================
  const removePeer = useCallback((peerId) => {
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].destroy();
      delete peersRef.current[peerId];
    }
    setRemoteStreams(prev => prev.filter(s => s.peerId !== peerId));
    setParticipants(prev => prev.filter(p => p.sid !== peerId));
    console.log(`👋 Peer supprimé : ${peerId}`);
  }, []);

  // ============================================================
  //  3. CRÉER UN PEER
  // ============================================================
  const createPeer = useCallback((targetId, isInitiator, stream = null) => {
    // Détruire l'ancien peer s'il existe
    if (peersRef.current[targetId]) {
      peersRef.current[targetId].destroy();
      delete peersRef.current[targetId];
    }

    console.log(`🔗 Création peer ${isInitiator ? '(initiateur)' : '(récepteur)'} → ${targetId}`);

    const peerOptions = {
      initiator: isInitiator,
      trickle: true,
      config: { iceServers: iceServers.current },
      // ✅ Options de performance
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      }
    };

    if (stream) {
      peerOptions.stream = stream;
    }

    const peer = new SimplePeer(peerOptions);

    // ── Signalement (offre / réponse / ICE) ──
    peer.on('signal', (signalData) => {
      if (!socket?.connected) return;

      if (signalData.type === 'offer') {
        socket.emit('webrtc_offer', { targetId, offer: signalData, roomId });
        console.log(`📤 Offre → ${targetId}`);

      } else if (signalData.type === 'answer') {
        socket.emit('webrtc_answer', { targetId, answer: signalData, roomId });
        console.log(`📤 Réponse → ${targetId}`);

      } else if (signalData.candidate) {
        socket.emit('ice_candidate', { targetId, candidate: signalData, roomId });
      }
    });

    // ── Réception du flux distant ──
    peer.on('stream', (remoteStream) => {
      console.log(`📡 Flux reçu de ${targetId}`);
      setRemoteStreams(prev => {
        const exists = prev.find(s => s.peerId === targetId);
        if (exists) {
          return prev.map(s =>
            s.peerId === targetId ? { ...s, stream: remoteStream } : s
          );
        }
        return [...prev, { peerId: targetId, stream: remoteStream }];
      });
    });

    // ── Connexion établie ──
    peer.on('connect', () => {
      console.log(`✅ Connexion P2P établie avec ${targetId}`);
    });

    // ── Erreur ──
    peer.on('error', (err) => {
      console.error(`❌ Erreur peer ${targetId}:`, err.message);
      removePeer(targetId);
    });

    // ── Fermeture ──
    peer.on('close', () => {
      console.log(`🔒 Peer fermé : ${targetId}`);
      removePeer(targetId);
    });

    peersRef.current[targetId] = peer;
    return peer;

  }, [socket, roomId, removePeer]);

  const ensurePeerConnections = useCallback((stream = null) => {
    if (!socket?.id || !Array.isArray(participants)) return;

    participants.forEach((p) => {
      if (!p?.sid || p.sid === socket.id) return;
      if (!peersRef.current[p.sid]) {
        createPeer(p.sid, true, stream || localStreamRef.current || null);
      }
    });
  }, [socket?.id, participants, createPeer]);

  const refreshAllPeerConnections = useCallback((stream = null) => {
    if (!socket?.id || !Array.isArray(participants)) return;

    const effectiveStream = stream || localStreamRef.current || null;
    participants.forEach((p) => {
      if (!p?.sid || p.sid === socket.id) return;
      removePeer(p.sid);
      createPeer(p.sid, true, effectiveStream);
    });
  }, [socket?.id, participants, removePeer, createPeer]);

  // ============================================================
  //  4. REJOINDRE LA SALLE
  // ============================================================
  const joinRoom = useCallback(async () => {
    if (!socket?.connected) {
      console.warn('⚠️ Socket non connecté');
      return;
    }

    // Tente d'initialiser les médias sans bloquer l'entrée en salle.
    let stream = localStreamRef.current;
    if (!stream) {
      stream = await initLocalStream();
    }

    socket.emit('join_room', { roomId, userName, userId }, (response) => {
      if (response?.error) {
        console.error('❌ Erreur join_room:', response.error);
        return;
      }

      console.log(`✅ Salle "${roomId}" rejointe`);

      if (response?.participants) {
        const normalized = normalizeParticipants(response.participants);
        setParticipants(normalized);

        // Initier connexion avec chaque participant existant
        normalized.forEach((participant) => {
          if (participant.sid !== socket.id) {
            createPeer(participant.sid, true, stream || null);
          }
        });
        setTimeout(() => ensurePeerConnections(stream || null), 250);
      }
    });
  }, [socket, roomId, userName, userId, initLocalStream, createPeer, normalizeParticipants, ensurePeerConnections]);

  // ============================================================
  //  5. QUITTER LA SALLE
  // ============================================================
  const leaveRoom = useCallback(() => {
    // Notifier le serveur
    socket?.emit('leave_room', { roomId });

    // Fermer tous les peers
    Object.keys(peersRef.current).forEach(peerId => {
      peersRef.current[peerId].destroy();
    });
    peersRef.current = {};

    // Arrêter flux local
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    // Arrêter partage écran
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    // Reset états
    setLocalStream(null);
    setRemoteStreams([]);
    setParticipants([]);
    setIsScreenSharing(false);
    setMediaError(null);

    console.log(`🚪 Salle "${roomId}" quittée`);
  }, [socket, roomId]);

  // ============================================================
  //  6. TOGGLE AUDIO
  // ============================================================
  const toggleAudio = useCallback(async () => {
    let audioTrack = localStreamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = audioStream.getAudioTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        localStreamRef.current.addTrack(audioTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsAudioEnabled(true);
        setMediaError(null);
        addTrackToPeers(audioTrack);
        ensurePeerConnections(localStreamRef.current);
        setTimeout(() => refreshAllPeerConnections(localStreamRef.current), 200);
        console.log('🎤 Piste audio ajoutée dynamiquement');
      } catch (err) {
        setMediaError(getMediaErrorMessage(err));
        console.error("❌ Impossible d'activer le micro:", err);
        return;
      }
    } else {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
      console.log(`🎤 Audio : ${audioTrack.enabled ? 'ON' : 'OFF'}`);
    }

    socket?.emit('media_state_change', {
      roomId,
      audio: audioTrack.enabled,
      video: isVideoEnabled
    });
  }, [socket, roomId, isVideoEnabled, addTrackToPeers, ensurePeerConnections, refreshAllPeerConnections]);

  // ============================================================
  //  7. TOGGLE VIDÉO
  // ============================================================
  const toggleVideo = useCallback(async () => {
    let videoTrack = localStreamRef.current?.getVideoTracks()[0];

    if (!videoTrack) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        videoTrack = videoStream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsVideoEnabled(true);
        setMediaError(null);
        addTrackToPeers(videoTrack);
        ensurePeerConnections(localStreamRef.current);
        setTimeout(() => refreshAllPeerConnections(localStreamRef.current), 200);
        console.log('📷 Piste vidéo ajoutée dynamiquement');
      } catch (err) {
        setMediaError(getMediaErrorMessage(err));
        console.error("❌ Impossible d'activer la caméra:", err);
        return;
      }
    } else {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
      console.log(`📷 Vidéo : ${videoTrack.enabled ? 'ON' : 'OFF'}`);
    }

    socket?.emit('media_state_change', {
      roomId,
      audio: isAudioEnabled,
      video: videoTrack.enabled
    });
  }, [socket, roomId, isAudioEnabled, addTrackToPeers, ensurePeerConnections, refreshAllPeerConnections]);

  // ============================================================
  //  8. PARTAGE D'ÉCRAN  ✅ Corrigé (boucle infinie résolue)
  // ============================================================
  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    // Remettre la caméra dans tous les peers
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer._pc?.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(cameraTrack);
      });
    }

    setIsScreenSharing(false);
    console.log('🖥️ Partage écran arrêté');
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: false
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Remplacer piste vidéo dans tous les peers
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer._pc?.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
      });

      // ✅ Utiliser stopScreenShare (pas toggleScreenShare) pour éviter la boucle
      screenTrack.onended = stopScreenShare;
      setIsScreenSharing(true);
      console.log('🖥️ Partage écran démarré');

    } catch (err) {
      console.error('❌ Erreur partage écran:', err);
    }
  }, [isScreenSharing, stopScreenShare]);

  // ============================================================
  //  9. ÉVÉNEMENTS SOCKET
  // ============================================================
  useEffect(() => {
    if (!socket) return;

    // ── Nouveau participant ──
    const onUserJoined = ({ userId, userName: name, participants: p }) => {
      console.log(`👤 Rejoint : ${name}`);
      setParticipants(normalizeParticipants(p || []));

      if (userId !== socket.id) {
        createPeer(userId, false, localStreamRef.current || null);
        setTimeout(() => ensurePeerConnections(localStreamRef.current || null), 150);
      }
    };

    // ── Participant parti ──
    const onUserLeft = ({ userId, participants: p }) => {
      setParticipants(normalizeParticipants(p || []));
      removePeer(userId);
    };

    // ── Offre WebRTC ──
    const onOffer = ({ offer, fromId }) => {
      console.log(`📥 Offre reçue de ${fromId}`);

      let peer = peersRef.current[fromId];
      if (!peer) {
        peer = createPeer(fromId, false, localStreamRef.current || null);
      }
      peer.signal(offer);
    };

    // ── Réponse WebRTC ──
    const onAnswer = ({ answer, fromId }) => {
      console.log(`📥 Réponse reçue de ${fromId}`);
      peersRef.current[fromId]?.signal(answer);
    };

    // ── Candidat ICE ──
    const onIceCandidate = ({ candidate, fromId }) => {
      peersRef.current[fromId]?.signal(candidate);
    };

    // ── Changement état média ──
    const onMediaStateChange = ({ userId, audio, video }) => {
      setParticipants(prev =>
        prev.map(p => p.sid === userId ? { ...p, audio, video } : p)
      );
    };

    const onHostForceMedia = ({ audio, video }) => {
      if (audio === false) {
        const audioTrack = localStreamRef.current?.getAudioTracks?.()[0];
        if (audioTrack) audioTrack.enabled = false;
        setIsAudioEnabled(false);
      }

      if (video === false) {
        const videoTrack = localStreamRef.current?.getVideoTracks?.()[0];
        if (videoTrack) videoTrack.enabled = false;
        setIsVideoEnabled(false);
      }
    };

    // Abonnements
    socket.on('user_joined',        onUserJoined);
    socket.on('user_left',          onUserLeft);
    socket.on('webrtc_offer',       onOffer);
    socket.on('webrtc_answer',      onAnswer);
    socket.on('ice_candidate',      onIceCandidate);
    socket.on('media_state_change', onMediaStateChange);
    socket.on('host_force_media',   onHostForceMedia);

    return () => {
      socket.off('user_joined',        onUserJoined);
      socket.off('user_left',          onUserLeft);
      socket.off('webrtc_offer',       onOffer);
      socket.off('webrtc_answer',      onAnswer);
      socket.off('ice_candidate',      onIceCandidate);
      socket.off('media_state_change', onMediaStateChange);
      socket.off('host_force_media',   onHostForceMedia);
    };
  }, [socket, createPeer, removePeer, normalizeParticipants, ensurePeerConnections]);

  // ── Nettoyage destruction du composant ──
  useEffect(() => {
    return () => { leaveRoom(); };
  }, []);

  // ============================================================
  //  RETOUR
  // ============================================================
  return {
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
  };
};

// ── Utilitaire messages d'erreur ──
const getMediaErrorMessage = (error) => {
  const messages = {
    NotFoundError:         '📵 Aucun périphérique audio/vidéo détecté',
    NotAllowedError:       '🔒 Accès refusé — autorisez caméra/micro',
    NotReadableError:      '⚠️ Périphérique occupé par une autre application',
    OverconstrainedError:  '⚙️ Contraintes médias non supportées',
    SecurityError:         '🔐 HTTPS requis pour accéder aux médias',
  };
  return messages[error.name] || `❌ ${error.message}`;
};

export default useWebRTC;


