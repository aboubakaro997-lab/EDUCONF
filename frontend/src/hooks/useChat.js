import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================
//  CONSTANTES
// ============================================================
const MAX_MESSAGES       = 200;   // Limite de messages en mémoire
const TYPING_TIMEOUT_MS  = 3000;  // Délai avant d'arrêter "est en train d'écrire"
const TYPING_DEBOUNCE_MS = 800;   // Anti-rebond frappe clavier

// ============================================================
//  UTILITAIRES
// ============================================================

/** Génère un ID unique pour chaque message */
const generateMessageId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Formate un timestamp ISO en heure lisible */
const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour:   '2-digit',
    minute: '2-digit',
  });
};

/** Formate la date d'un message (Aujourd'hui / Hier / Date) */
const formatDate = (isoString) => {
  const date  = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString())     return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return 'Hier';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

// ============================================================
//  HOOK PRINCIPAL
// ============================================================
const useChat = (socket, roomId, currentUser) => {

  // ── États ──
  const [messages,    setMessages]    = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen,  setIsChatOpen]  = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);  // [{ userId, userName }]
  const [isLoading,   setIsLoading]   = useState(false);
  const [chatError,   setChatError]   = useState(null);

  // ── Refs ──
  const messagesEndRef    = useRef(null);   // Pour auto-scroll
  const typingTimeouts    = useRef({});     // { userId: timeoutId }
  const typingDebounceRef = useRef(null);   // Anti-rebond frappe
  const isChatOpenRef     = useRef(false);  // Version ref de isChatOpen (pour les closures)
  const inputRef          = useRef(null);   // Ref vers l'input du chat

  // Garder isChatOpenRef synchronisé
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  // ============================================================
  //  1. AUTO-SCROLL EN BAS
  // ============================================================
  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }, 80);
  }, []);

  // ============================================================
  //  2. AJOUTER UN MESSAGE (interne)
  // ============================================================
  const addMessage = useCallback((newMessage) => {
    setMessages(prev => {
      // Éviter les doublons par ID
      if (prev.find(m => m.id === newMessage.id)) return prev;

      // Limiter la taille de l'historique
      const updated = [...prev, newMessage];
      return updated.length > MAX_MESSAGES
        ? updated.slice(updated.length - MAX_MESSAGES)
        : updated;
    });
  }, []);

  // ============================================================
  //  3. ENVOYER UN MESSAGE
  // ============================================================
  const sendMessage = useCallback((text) => {
    if (!text?.trim())         return false;
    if (!socket?.connected) {
      setChatError('❌ Connexion perdue — message non envoyé');
      return false;
    }
    setChatError(null);

    const message = {
      id:        generateMessageId(),
      text:      text.trim(),
      sender:    currentUser?.full_name || currentUser?.username || 'Moi',
      senderId:  socket.id,
      roomId,
      timestamp: new Date().toISOString(),
      isLocal:   true,
      status:    'sent',    // sent | delivered | read
      type:      'text',    // text | file | system
    };

    // ── Optimistic Update : afficher immédiatement ──
    addMessage(message);
    scrollToBottom();

    // ── Envoyer au serveur ──
    socket.emit(
      'chat_message',
      {
        roomId,
        message:   message.text,
        userName:  message.sender,
        messageId: message.id,
        timestamp: message.timestamp,
      },
      (ack) => {
        // Confirmation du serveur
        if (ack?.error) {
          setChatError(`❌ Erreur envoi : ${ack.error}`);
          // Marquer le message comme échoué
          setMessages(prev =>
            prev.map(m =>
              m.id === message.id ? { ...m, status: 'failed' } : m
            )
          );
        } else {
          // Marquer comme délivré
          setMessages(prev =>
            prev.map(m =>
              m.id === message.id ? { ...m, status: 'delivered' } : m
            )
          );
        }
      }
    );

    // ── Arrêter l'indicateur de frappe ──
    stopTyping();

    return true;
  }, [socket, roomId, currentUser, addMessage, scrollToBottom]);

  // ============================================================
  //  4. INDICATEUR DE FRAPPE
  // ============================================================

  /** Démarrer "est en train d'écrire" */
  const startTyping = useCallback(() => {
    if (!socket?.connected) return;

    // Annuler le debounce précédent
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }

    // Envoyer l'événement de frappe
    socket.emit('typing_start', {
      roomId,
      userName: currentUser?.username || currentUser || 'Quelqu\'un',
      userId:   socket.id,
    });

    // Auto-stop après TYPING_TIMEOUT_MS
    typingDebounceRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT_MS);

  }, [socket, roomId, currentUser]);

  /** Arrêter "est en train d'écrire" */
  const stopTyping = useCallback(() => {
    if (!socket?.connected) return;

    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }

    socket.emit('typing_stop', {
      roomId,
      userId: socket.id,
    });
  }, [socket, roomId]);

  /**
   * Gestionnaire de frappe à brancher sur l'input
   * Usage : <input onChange={handleInputChange} />
   */
  const handleInputChange = useCallback(() => {
    // Debounce : n'envoyer qu'après TYPING_DEBOUNCE_MS d'inactivité
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    startTyping();
  }, [startTyping]);

  // ============================================================
  //  5. OUVRIR / FERMER LE CHAT
  // ============================================================
  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
        scrollToBottom(false);
        // Focus sur l'input quand le chat s'ouvre
        setTimeout(() => inputRef.current?.focus(), 150);
      }
      return next;
    });
  }, [scrollToBottom]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    setUnreadCount(0);
    scrollToBottom(false);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [scrollToBottom]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    stopTyping();
  }, [stopTyping]);

  // ============================================================
  //  6. SUPPRIMER UN MESSAGE
  // ============================================================
  const deleteMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    socket?.emit('delete_message', { roomId, messageId });
  }, [socket, roomId]);

  // ============================================================
  //  7. RÉESSAYER UN MESSAGE ÉCHOUÉ
  // ============================================================
  const retryMessage = useCallback((messageId) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    // Supprimer l'ancien + renvoyer
    setMessages(prev => prev.filter(m => m.id !== messageId));
    sendMessage(message.text);
  }, [messages, sendMessage]);

  // ============================================================
  //  8. VIDER LE CHAT
  // ============================================================
  const clearChat = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
    setChatError(null);
  }, []);

  // ============================================================
  //  9. GESTION DES UTILISATEURS QUI TAPENT
  // ============================================================
  const addTypingUser = useCallback(({ userId, userName }) => {
    setTypingUsers(prev => {
      if (prev.find(u => u.userId === userId)) return prev;
      return [...prev, { userId, userName }];
    });

    // Auto-supprimer si aucun stop reçu après TYPING_TIMEOUT_MS
    if (typingTimeouts.current[userId]) {
      clearTimeout(typingTimeouts.current[userId]);
    }
    typingTimeouts.current[userId] = setTimeout(() => {
      removeTypingUser(userId);
    }, TYPING_TIMEOUT_MS + 500);
  }, []);

  const removeTypingUser = useCallback((userId) => {
    setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    if (typingTimeouts.current[userId]) {
      clearTimeout(typingTimeouts.current[userId]);
      delete typingTimeouts.current[userId];
    }
  }, []);

  /** Texte affiché sous le chat : "Alice est en train d'écrire..." */
  const typingText = useCallback(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].userName} est en train d'écrire...`;
    if (typingUsers.length === 2) return `${typingUsers[0].userName} et ${typingUsers[1].userName} écrivent...`;
    return `${typingUsers.length} personnes écrivent...`;
  }, [typingUsers]);

  // ============================================================
  //  10. GROUPEMENT DES MESSAGES PAR DATE
  // ============================================================
  const groupedMessages = useCallback(() => {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const date = formatDate(msg.timestamp);

      if (date !== currentDate) {
        groups.push({ type: 'date-separator', date, id: `sep-${date}` });
        currentDate = date;
      }

      groups.push({ ...msg, type: 'message' });
    });

    return groups;
  }, [messages]);

  // ============================================================
  //  11. CHARGER L'HISTORIQUE
  // ============================================================
  const loadHistory = useCallback(() => {
    if (!socket?.connected || !roomId) return;

    setIsLoading(true);
    setChatError(null);

    socket.emit('get_chat_history', { roomId }, (response) => {
      setIsLoading(false);

      if (response?.error) {
        setChatError(`❌ Impossible de charger l'historique : ${response.error}`);
        return;
      }

      if (Array.isArray(response?.messages)) {
        const history = response.messages.map(m => ({
          id:        m.messageId || generateMessageId(),
          text:      m.message,
          sender:    m.userName,
          senderId:  m.senderId,
          timestamp: m.timestamp || new Date().toISOString(),
          isLocal:   m.senderId === socket.id,
          status:    'delivered',
          type:      'text',
        }));

        setMessages(history);
        scrollToBottom(false);
        console.log(`📜 Historique chargé : ${history.length} message(s)`);
      }
    });
  }, [socket, roomId, scrollToBottom]);

  // ============================================================
  //  12. ÉVÉNEMENTS SOCKET
  // ============================================================
  useEffect(() => {
    if (!socket) return;

    // ── Nouveau message reçu ──
    const onChatMessage = ({ messageId, message, userName, senderId, timestamp }) => {
      // Ignorer les messages de soi-même (déjà ajoutés en optimistic update)
      if (senderId === socket.id) return;

      const newMsg = {
        id:        messageId || generateMessageId(),
        text:      message,
        sender:    userName,
        senderId,
        timestamp: timestamp || new Date().toISOString(),
        isLocal:   false,
        status:    'delivered',
        type:      'text',
      };

      addMessage(newMsg);

      // Incrémenter les non-lus si le chat est fermé
      if (!isChatOpenRef.current) {
        setUnreadCount(prev => prev + 1);
      } else {
        scrollToBottom();
      }
    };

    // ── Début de frappe ──
    const onTypingStart = ({ userId, userName }) => {
      if (userId === socket.id) return;  // Ignorer sa propre frappe
      addTypingUser({ userId, userName });
    };

    // ── Fin de frappe ──
    const onTypingStop = ({ userId }) => {
      removeTypingUser(userId);
    };

    // ── Message supprimé ──
    const onMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    // ── Message système (participant rejoint / parti) ──
    const onSystemMessage = ({ text }) => {
      const sysMsg = {
        id:        generateMessageId(),
        text,
        sender:    'Système',
        senderId:  'system',
        timestamp: new Date().toISOString(),
        isLocal:   false,
        status:    'delivered',
        type:      'system',
      };
      addMessage(sysMsg);
      scrollToBottom();
    };

    // ── Confirmation livraison ──
    const onMessageDelivered = ({ messageId }) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, status: 'delivered' } : m
        )
      );
    };

    // ── Abonnements ──
    socket.on('chat_message',       onChatMessage);
    socket.on('typing_start',       onTypingStart);
    socket.on('typing_stop',        onTypingStop);
    socket.on('message_deleted',    onMessageDeleted);
    socket.on('system_message',     onSystemMessage);
    socket.on('message_delivered',  onMessageDelivered);

    // ── Charger l'historique à la connexion ──
    loadHistory();

    // ── Nettoyage ──
    return () => {
      socket.off('chat_message',       onChatMessage);
      socket.off('typing_start',       onTypingStart);
      socket.off('typing_stop',        onTypingStop);
      socket.off('message_deleted',    onMessageDeleted);
      socket.off('system_message',     onSystemMessage);
      socket.off('message_delivered',  onMessageDelivered);
    };

  }, [socket, addMessage, addTypingUser, removeTypingUser, scrollToBottom, loadHistory]);

  // ============================================================
  //  13. NETTOYAGE À LA DESTRUCTION
  // ============================================================
  useEffect(() => {
    return () => {
      // Nettoyer tous les timeouts de frappe
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, []);

  // ============================================================
  //  RETOUR DU HOOK
  // ============================================================
  return {
    // ── États ──
    messages,
    unreadCount,
    isChatOpen,
    typingUsers,
    typingText: typingText(),
    isLoading,
    chatError,
    groupedMessages: groupedMessages(),

    // ── Refs ──
    messagesEndRef,
    inputRef,

    // ── Actions messages ──
    sendMessage,
    deleteMessage,
    retryMessage,
    clearChat,
    loadHistory,

    // ── Actions frappe ──
    startTyping,
    stopTyping,
    handleInputChange,

    // ── Actions chat ──
    toggleChat,
    openChat,
    closeChat,

    // ── Utilitaires ──
    formatTime,
    formatDate,
  };
};

export default useChat;
