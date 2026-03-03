import { useEffect, useState, useCallback, useRef } from 'react';
import { socketService } from '../services/socket';

const useSocket = (token) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [socket, setSocket] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // ============ CONNEXION AU SOCKET ============
  const connect = useCallback(() => {
    if (!token) {
      setConnectionError('Token d\'authentification manquant');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const socketInstance = socketService.connect(token);
      setSocket(socketInstance);

      // ✅ Connexion établie
      socketInstance.on('connect', () => {
        console.log('✅ Socket connecté :', socketInstance.id);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      });

      // ❌ Déconnexion
      socketInstance.on('disconnect', (reason) => {
        console.warn('❌ Socket déconnecté :', reason);
        setIsConnected(false);

        // Reconnexion automatique selon la raison
        if (reason === 'io server disconnect') {
          // Déconnexion forcée par le serveur, ne pas reconnecter
          setConnectionError('Déconnecté par le serveur');
        }
      });

      // ⚠️ Erreur de connexion
      socketInstance.on('connect_error', (error) => {
        console.error('⚠️ Erreur de connexion socket :', error.message);
        setIsConnecting(false);
        reconnectAttempts.current += 1;

        if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionError(`Impossible de se connecter après ${maxReconnectAttempts} tentatives`);
          socketService.disconnect();
        } else {
          setConnectionError(`Tentative de reconnexion... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
        }
      });

      // 🔄 Tentative de reconnexion
      socketInstance.on('reconnect_attempt', (attempt) => {
        console.log(`🔄 Tentative de reconnexion #${attempt}`);
        setIsConnecting(true);
        setConnectionError(`Reconnexion en cours... (${attempt}/${maxReconnectAttempts})`);
      });

      // ✅ Reconnexion réussie
      socketInstance.on('reconnect', (attempt) => {
        console.log(`✅ Reconnecté après ${attempt} tentative(s)`);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      });

      // ❌ Reconnexion échouée
      socketInstance.on('reconnect_failed', () => {
        console.error('❌ Reconnexion échouée définitivement');
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionError('Reconnexion impossible. Veuillez rafraîchir la page.');
      });

    } catch (error) {
      console.error('❌ Erreur lors de la connexion socket :', error);
      setIsConnecting(false);
      setConnectionError('Erreur inattendue lors de la connexion');
    }
  }, [token]);

  // ============ DÉCONNEXION DU SOCKET ============
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setSocket(null);
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
    console.log('🔌 Socket déconnecté manuellement');
  }, []);

  // ============ ÉMETTRE UN ÉVÉNEMENT ============
  const emit = useCallback((event, data, callback) => {
    if (!socket?.connected) {
      console.warn(`⚠️ Impossible d'émettre "${event}" : socket non connecté`);
      return false;
    }
    if (callback) {
      socket.emit(event, data, callback);
    } else {
      socket.emit(event, data);
    }
    return true;
  }, [socket]);

  // ============ ÉCOUTER UN ÉVÉNEMENT ============
  const on = useCallback((event, handler) => {
    if (!socket) {
      console.warn(`⚠️ Impossible d'écouter "${event}" : socket non initialisé`);
      return;
    }
    socket.on(event, handler);
  }, [socket]);

  // ============ SUPPRIMER UN ÉCOUTEUR ============
  const off = useCallback((event, handler) => {
    if (!socket) return;
    if (handler) {
      socket.off(event, handler);
    } else {
      socket.off(event);
    }
  }, [socket]);

  // ============ REJOINDRE UNE SALLE ============
  const joinRoom = useCallback((roomId, userName, userId) => {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error('Socket non connecté'));
        return;
      }

      socket.emit('join_room', { roomId, userName, userId }, (response) => {
        if (response?.error) {
          console.error('❌ Erreur join_room :', response.error);
          reject(new Error(response.error));
        } else {
          console.log(`✅ Salle "${roomId}" rejointe avec succès`);
          resolve(response);
        }
      });
    });
  }, [socket]);

  // ============ QUITTER UNE SALLE ============
  const leaveRoom = useCallback((roomId) => {
    if (!socket?.connected) return;
    socket.emit('leave_room', { roomId });
    console.log(`🚪 Salle "${roomId}" quittée`);
  }, [socket]);

  // ============ ENVOYER UN MESSAGE CHAT ============
  const sendChatMessage = useCallback((roomId, message, userName) => {
    return emit('chat_message', { roomId, message, userName });
  }, [emit]);

  // ============ SIGNALEMENT WEBRTC ============
  const sendOffer = useCallback((targetId, offer, roomId) => {
    return emit('webrtc_offer', { targetId, offer, roomId });
  }, [emit]);

  const sendAnswer = useCallback((targetId, answer) => {
    return emit('webrtc_answer', { targetId, answer });
  }, [emit]);

  const sendIceCandidate = useCallback((targetId, candidate) => {
    return emit('ice_candidate', { targetId, candidate });
  }, [emit]);

  // ============ NOTIFIER L'ÉTAT DES MÉDIAS ============
  const notifyMediaStateChange = useCallback((roomId, audio, video) => {
    return emit('media_state_change', { roomId, audio, video });
  }, [emit]);

  // ============ CYCLE DE VIE ============
  useEffect(() => {
    if (token) {
      connect();
    }

    // Nettoyage à la destruction du composant
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // ============ RETOUR DU HOOK ============
  return {
    socket,
    isConnected,
    isConnecting,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    notifyMediaStateChange
  };
};

export default useSocket;
