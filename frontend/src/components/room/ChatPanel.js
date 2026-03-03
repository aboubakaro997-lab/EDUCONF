import React, { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
//  SOUS-COMPOSANT : Séparateur de date
// ============================================================
const DateSeparator = ({ date }) => (
  <div className="flex items-center gap-3 py-2">
    <div className="flex-1 h-px bg-ci-gray-700/60" />
    <span className="
      text-ci-gray-500 text-[10px] font-semibold uppercase
      tracking-wider bg-ci-gray-900 px-2 flex-shrink-0
    ">
      {date}
    </span>
    <div className="flex-1 h-px bg-ci-gray-700/60" />
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Bulle de message système
// ============================================================
const SystemMessage = ({ text }) => (
  <div className="flex justify-center py-1">
    <span className="
      text-[11px] text-ci-gray-500 font-medium
      bg-ci-gray-800/70 px-3 py-1 rounded-full
      border border-ci-gray-700/50
    ">
      {text}
    </span>
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Statut du message
// ============================================================
const MessageStatus = ({ status }) => {
  if (!status) return null;

  const statusConfig = {
    sending:   { icon: '⏳', color: 'text-ci-gray-500', title: 'Envoi...' },
    sent:      { icon: '✓',  color: 'text-ci-gray-400', title: 'Envoyé' },
    delivered: { icon: '✓✓', color: 'text-ci-gray-400', title: 'Délivré' },
    read:      { icon: '✓✓', color: 'text-ci-green',    title: 'Lu' },
    failed:    { icon: '!',  color: 'text-red-400',     title: 'Échec' },
  };

  const cfg = statusConfig[status] || statusConfig.sent;

  return (
    <span
      className={`text-[10px] font-bold ${cfg.color}`}
      title={cfg.title}
    >
      {cfg.icon}
    </span>
  );
};

// ============================================================
//  SOUS-COMPOSANT : Bulle de message
// ============================================================
const MessageBubble = ({
  message,
  isMe,
  isConsecutive,
  onDelete,
  onRetry,
  formatTime,
}) => {
  const [showActions, setShowActions] = useState(false);
  const isFailed = message.status === 'failed';

  return (
    <div
      className={`
        flex gap-2 group
        ${isMe ? 'flex-row-reverse' : 'flex-row'}
        ${isConsecutive ? 'mt-0.5' : 'mt-3'}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* ── Avatar (masqué si message consécutif) ── */}
      <div className="flex-shrink-0 w-8">
        {!isConsecutive && !isMe && (
          <div className="
            w-8 h-8 rounded-full
            bg-gradient-to-br from-ci-orange to-orange-700
            flex items-center justify-center
            text-white text-xs font-bold
            border-2 border-ci-gray-800
            shadow-md
          ">
            {(message.sender || '?')
              .split(' ')
              .map(w => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
        )}
      </div>

      {/* ── Contenu ── */}
      <div className={`
        flex flex-col max-w-[78%]
        ${isMe ? 'items-end' : 'items-start'}
      `}>

        {/* Nom de l'expéditeur */}
        {!isConsecutive && !isMe && (
          <span className="
            text-ci-orange text-[11px] font-semibold
            mb-1 px-1 truncate max-w-full
          ">
            {message.sender}
          </span>
        )}

        {/* Bulle + actions */}
        <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

          {/* Boutons d'action (hover) */}
          {showActions && (
            <div className={`
              flex items-center gap-1
              ${isMe ? 'flex-row-reverse' : 'flex-row'}
            `}>
              {isFailed && (
                <button
                  onClick={() => onRetry?.(message.id)}
                  className="
                    w-6 h-6 rounded-full
                    bg-ci-gray-700 hover:bg-ci-orange
                    text-ci-gray-300 hover:text-white
                    flex items-center justify-center
                    text-[10px] transition-all duration-150
                    shadow-sm
                  "
                  title="Réessayer"
                >
                  🔄
                </button>
              )}
              {isMe && !isFailed && (
                <button
                  onClick={() => onDelete?.(message.id)}
                  className="
                    w-6 h-6 rounded-full
                    bg-ci-gray-700 hover:bg-red-600
                    text-ci-gray-300 hover:text-white
                    flex items-center justify-center
                    text-[10px] transition-all duration-150
                    shadow-sm
                  "
                  title="Supprimer"
                >
                  🗑
                </button>
              )}
            </div>
          )}

          {/* Bulle principale */}
          <div className={`
            relative px-3 py-2 shadow-md
            transition-all duration-200
            ${isMe
              ? `bg-ci-orange text-white
                 rounded-2xl rounded-br-sm
                 ${isConsecutive ? 'rounded-tr-2xl' : ''}`
              : `bg-ci-gray-800 text-white
                 border border-ci-gray-700/50
                 rounded-2xl rounded-bl-sm
                 ${isConsecutive ? 'rounded-tl-2xl' : ''}`
            }
            ${isFailed
              ? 'opacity-60 border !border-red-500/60 bg-red-900/20'
              : ''
            }
          `}>
            {/* Texte */}
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
              {message.text}
            </p>

            {/* Footer bulle : heure + statut */}
            <div className={`
              flex items-center gap-1.5 mt-1
              ${isMe ? 'justify-end' : 'justify-start'}
            `}>
              <span className="text-[10px] opacity-55 font-medium">
                {formatTime?.(message.timestamp)}
              </span>
              {isMe && <MessageStatus status={message.status} />}
            </div>
          </div>
        </div>

        {/* Message d'erreur en cas d'échec */}
        {isFailed && (
          <span className="text-red-400 text-[10px] mt-1 px-1">
            ⚠️ Échec — Cliquez 🔄 pour réessayer
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================
//  SOUS-COMPOSANT : Indicateur de frappe
// ============================================================
const TypingIndicator = ({ text }) => {
  if (!text) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-ci-orange rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-ci-gray-400 text-xs italic">{text}</span>
    </div>
  );
};

// ============================================================
//  SOUS-COMPOSANT : Zone de saisie
// ============================================================
const ChatInput = ({
  inputRef,
  onSendMessage,
  onInputChange,
  disabled = false,
}) => {
  const [value,     setValue]    = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // ✅ handleChange stable (pas de dépendances changeantes)
  const handleChange = useCallback((e) => {
    setValue(e.target.value);
    onInputChange?.();
  }, [onInputChange]);

  // ✅ handleSubmit avec dépendances correctes
  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    const sent = onSendMessage?.(text);
    // Ne vide pas le champ si l'envoi a echoue (ex: socket deconnecte)
    if (sent !== false) {
      setValue('');
    }
  }, [value, disabled, onSendMessage]);

  // ✅ handleKeyDown dépend de handleSubmit stabilisé
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // ✅ Auto-resize stable
  const handleInput = useCallback((e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px';
  }, []);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className={`
        flex items-end gap-2 p-3
        bg-ci-gray-900 border-t
        transition-all duration-200
        ${isFocused ? 'border-ci-orange/50' : 'border-ci-gray-700/60'}
      `}
    >
      <div className={`
        flex-1 relative rounded-2xl overflow-hidden
        border transition-all duration-200
        ${isFocused
          ? 'border-ci-orange/60 bg-ci-gray-800'
          : 'border-ci-gray-700 bg-ci-gray-800/80'
        }
      `}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onInput={handleInput}
          placeholder="Écrire un message... (Entrée pour envoyer)"
          disabled={disabled}
          rows={1}
          className="
            w-full bg-transparent text-white text-sm
            px-3.5 py-2.5 resize-none outline-none
            placeholder:text-ci-gray-500
            max-h-28 min-h-[40px]
            disabled:opacity-50 disabled:cursor-not-allowed
            scrollbar-thin scrollbar-thumb-ci-gray-700
            scrollbar-track-transparent
            leading-relaxed
          "
          style={{
            height: 'auto',
            overflowY: value.split('\n').length > 3 ? 'auto' : 'hidden',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!canSend}
        className={`
          w-10 h-10 rounded-2xl flex-shrink-0
          flex items-center justify-center
          transition-all duration-200 shadow-md
          focus:outline-none focus:ring-2 focus:ring-ci-orange/50
          ${canSend
            ? 'bg-ci-orange hover:bg-orange-600 active:scale-95 text-white shadow-orange-900/30'
            : 'bg-ci-gray-700 text-ci-gray-500 cursor-not-allowed'
          }
        `}
        title="Envoyer (Entrée)"
        aria-label="Envoyer le message"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </form>
  );
};

// ============================================================
//  SOUS-COMPOSANT : État vide
// ============================================================
const EmptyChat = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center py-12">
    <div className="
      w-16 h-16 rounded-2xl
      bg-gradient-to-br from-ci-gray-800 to-ci-gray-700
      flex items-center justify-center text-3xl
      border border-ci-gray-700/50 shadow-inner
    ">
      💬
    </div>
    <div>
      <p className="text-white font-semibold text-sm mb-1">
        Aucun message pour l'instant
      </p>
      <p className="text-ci-gray-500 text-xs leading-relaxed">
        Soyez le premier à écrire !<br />
        Les messages sont visibles par tous les participants.
      </p>
    </div>
    <div className="flex items-center gap-2 mt-2">
      <span className="text-2xl">🐘</span>
      <span className="text-ci-orange text-xs font-semibold">EduConf CI</span>
    </div>
  </div>
);

// ============================================================
//  SOUS-COMPOSANT : Bouton scroll vers le bas
// ============================================================
const ScrollToBottomBtn = ({ onClick, unreadCount }) => (
  <button
    onClick={onClick}
    className="
      absolute bottom-4 left-1/2 -translate-x-1/2
      flex items-center gap-2
      bg-ci-gray-800 hover:bg-ci-gray-700
      border border-ci-gray-600 text-white
      text-xs font-semibold px-3 py-1.5 rounded-full
      shadow-xl transition-all duration-200
      active:scale-95 z-10
    "
  >
    {unreadCount > 0 && (
      <span className="
        bg-ci-orange text-white text-[10px] font-bold
        px-1.5 py-0.5 rounded-full min-w-[18px] text-center
      ">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
    </svg>
    Nouveaux messages
  </button>
);

// ============================================================
//  COMPOSANT PRINCIPAL — ChatPanel
// ============================================================
const ChatPanel = ({
  messages        = [],
  unreadCount     = 0,
  typingText      = null,
  isLoading       = false,
  chatError       = null,
  messagesEndRef,
  inputRef,
  currentUser,
  onSendMessage,
  onDeleteMessage,
  onRetryMessage,
  onInputChange,
  onClose,
  formatTime,
}) => {
  const scrollContainerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [localUnread,   setLocalUnread]   = useState(0);
  const isAtBottomRef = useRef(true);

  // ✅ FIX : handleScroll stable (scrollContainerRef est une ref stable)
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const threshold = 100;
    const isAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    isAtBottomRef.current = isAtBottom;
    setShowScrollBtn(!isAtBottom);
    if (isAtBottom) setLocalUnread(0);
  }, []); // ✅ pas de dépendances : refs sont stables

  // ✅ FIX : scrollToBottom stable
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top:      el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setShowScrollBtn(false);
    setLocalUnread(0);
  }, []); // ✅ pas de dépendances : scrollContainerRef est stable

  // ✅ FIX : dépendances complètes — messages.length, scrollToBottom, currentUser?.id
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];

    if (lastMsg?.type === 'message') {
      const isMyMessage =
        lastMsg.isLocal ||
        lastMsg.senderId === currentUser?.id;

      if (isAtBottomRef.current || isMyMessage) {
        scrollToBottom(true);
      } else {
        setLocalUnread(prev => prev + 1);
      }
    }
  }, [messages, scrollToBottom, currentUser?.id]); // ✅ CORRIGÉ

  // ✅ FIX : ajout de scrollToBottom dans les dépendances
  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]); // ✅ CORRIGÉ

  // ============================================================
  //  RENDU
  // ============================================================
  return (
    <div className="flex flex-col h-full bg-ci-gray-900 overflow-hidden">

      {/* ══════════════════════════════════
          HEADER
      ══════════════════════════════════ */}
      <div className="
        flex items-center justify-between
        px-4 py-3 flex-shrink-0
        bg-ci-gray-900
        border-b border-ci-gray-700/60
      ">
        <div className="flex items-center gap-2.5">
          <div className="
            w-8 h-8 rounded-xl bg-gradient-to-br
            from-ci-orange/20 to-orange-700/20
            border border-ci-orange/30
            flex items-center justify-center text-base
          ">
            💬
          </div>
          <div>
            <h3 className="text-white font-bold text-sm leading-tight">
              Chat de la salle
            </h3>
            <p className="text-ci-gray-500 text-[10px]">
              {messages.filter(m => m.type === 'message').length} message(s)
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="
            w-8 h-8 rounded-lg
            flex items-center justify-center
            text-ci-gray-400 hover:text-white
            hover:bg-ci-gray-700
            transition-all duration-200
            text-base leading-none
          "
          title="Fermer le chat"
          aria-label="Fermer le chat"
        >
          ✕
        </button>
      </div>

      {/* ── Bandeau drapeau 🇨🇮 ── */}
      <div className="h-0.5 bg-gradient-to-r from-ci-orange via-white to-ci-green flex-shrink-0" />

      {/* ══════════════════════════════════
          ZONE MESSAGES
      ══════════════════════════════════ */}
      <div className="flex-1 relative overflow-hidden">

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-4 border-ci-gray-700 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-ci-orange rounded-full animate-spin" />
            </div>
            <p className="text-ci-gray-500 text-xs">Chargement des messages...</p>
          </div>

        ) : messages.length === 0 ? (
          <EmptyChat />

        ) : (
          <>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="
                h-full overflow-y-auto
                px-3 py-3
                scroll-smooth
                scrollbar-thin
                scrollbar-thumb-ci-gray-700
                scrollbar-track-transparent
                hover:scrollbar-thumb-ci-gray-600
              "
            >
              {messages.map((item, index) => {

                if (item.type === 'date-separator') {
                  return <DateSeparator key={item.id} date={item.date} />;
                }

                if (item.type === 'system') {
                  return <SystemMessage key={item.id} text={item.text} />;
                }

                const isMe =
                  item.isLocal ||
                  item.senderId === currentUser?.id ||
                  item.sender === (currentUser?.full_name || currentUser?.username);

                const prevItem = messages[index - 1];
                const isConsecutive =
                  prevItem &&
                  prevItem.type === 'message' &&
                  prevItem.senderId === item.senderId &&
                  (new Date(item.timestamp) - new Date(prevItem.timestamp)) < 120000;

                return (
                  <MessageBubble
                    key={item.id}
                    message={item}
                    isMe={isMe}
                    isConsecutive={isConsecutive}
                    onDelete={onDeleteMessage}
                    onRetry={onRetryMessage}
                    formatTime={formatTime}
                  />
                );
              })}

              <div ref={messagesEndRef} className="h-1" />
            </div>

            {showScrollBtn && (
              <ScrollToBottomBtn
                onClick={() => scrollToBottom(true)}
                unreadCount={localUnread}
              />
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════
          INDICATEUR DE FRAPPE
      ══════════════════════════════════ */}
      {typingText && (
        <div className="
          flex-shrink-0
          border-t border-ci-gray-700/40
          bg-ci-gray-900/80
        ">
          <TypingIndicator text={typingText} />
        </div>
      )}

      {chatError && (
        <div className="px-3 py-2 border-t border-red-500/30 bg-red-900/20">
          <p className="text-red-300 text-xs">{chatError}</p>
        </div>
      )}

      {/* ══════════════════════════════════
          ZONE DE SAISIE
      ══════════════════════════════════ */}
      <div className="flex-shrink-0">
        <ChatInput
          inputRef={inputRef}
          onSendMessage={onSendMessage}
          onInputChange={onInputChange}
          disabled={false}
        />
      </div>

      {/* ══════════════════════════════════
          FOOTER HINT
      ══════════════════════════════════ */}
      <div className="
        flex-shrink-0 px-3 py-1.5
        flex items-center justify-center gap-1
        bg-ci-gray-900 border-t border-ci-gray-800/60
      ">
        <span className="text-[9px] text-ci-gray-600 font-medium">
          <kbd className="
            bg-ci-gray-800 border border-ci-gray-700
            px-1 py-0.5 rounded text-[8px] font-mono
          ">Entrée</kbd>
          {' '}envoyer •{' '}
          <kbd className="
            bg-ci-gray-800 border border-ci-gray-700
            px-1 py-0.5 rounded text-[8px] font-mono
          ">Shift+Entrée</kbd>
          {' '}saut de ligne
        </span>
      </div>
    </div>
  );
};

export default ChatPanel;
