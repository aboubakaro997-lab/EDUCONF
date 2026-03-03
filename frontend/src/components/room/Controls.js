import React, { useState, useEffect, useCallback } from 'react';

// ============================================================
//  HOOK TIMER INTERNE
// ============================================================
const useSessionTimer = (startedAt = null, storageKey = 'room_session_started_at') => {
  const [seconds, setSeconds] = useState(0);
  const [effectiveStart, setEffectiveStart] = useState(() => {
    if (startedAt) return startedAt;
    const stored = sessionStorage.getItem(storageKey);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  });

  useEffect(() => {
    if (startedAt && startedAt !== effectiveStart) {
      setEffectiveStart(startedAt);
      sessionStorage.setItem(storageKey, String(startedAt));
      return;
    }

    if (!startedAt) {
      const stored = sessionStorage.getItem(storageKey);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed) && parsed !== effectiveStart) {
        setEffectiveStart(parsed);
        return;
      }
      if (!Number.isFinite(parsed)) {
        sessionStorage.setItem(storageKey, String(effectiveStart));
      }
    }
  }, [startedAt, effectiveStart, storageKey]);

  useEffect(() => {
    const compute = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - effectiveStart) / 1000));
      setSeconds(elapsed);
    };

    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [effectiveStart]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
};

// ============================================================
//  ICÔNES SVG — Correctes et précises
// ============================================================
const Icons = {
  // 🎤 Micro activé
  MicOn: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  ),

  // 🎤 Micro coupé
  MicOff: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28z"/>
      <path d="M14.98 11.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99z"/>
      <path d="M4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
    </svg>
  ),

  // 📷 Caméra activée
  VideoOn: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  ),

  // 📷 Caméra désactivée
  VideoOff: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 6.5l-4-4-9.9 9.9-2.6-2.6L3 11.3l5 5L21 6.5z"/>
      <path d="M7 15.5L3 11.3v5.2c0 .6.4 1 1 1h8.8L7 15.5z"/>
    </svg>
  ),

  // 🖥️ Écran partagé
  ScreenOn: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
      <path d="M12 9l-4 4h3v4h2v-4h3l-4-4z"/>
    </svg>
  ),

  // 🖥️ Partager l'écran
  ScreenOff: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
      <path d="M12 15l4-4h-3V7h-2v4H8l4 4z"/>
    </svg>
  ),

  // 💬 Chat
  Chat: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </svg>
  ),

  // ✋ Lever la main
  HandOn: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 7c0-1.1-.9-2-2-2-.28 0-.54.06-.78.16C17.95 4.48 17.14 4 16.22 4c-.34 0-.67.08-.96.22C14.93 3.49 14.12 3 13.22 3 12.55 3 12 3.55 12 4.22V9c-.55-.95-1.55-1-2-1-1.1 0-2 .9-2 2 0 .28.06.54.17.77L10 13c.83 1.44 1.3 3.06 1.41 4.73L11.5 19H19c.5 0 .94-.34 1.06-.83L21 12v-5z"/>
    </svg>
  ),

  // 👥 Participants
  Participants: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  ),

  // 📞 Raccrocher
  Leave: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
    </svg>
  ),

  // ⋯ Plus d'options
  More: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
  ),
};

// ============================================================
//  SOUS-COMPOSANT : Bouton de contrôle réutilisable
// ============================================================
const ControlButton = ({
  onClick,
  title,
  isActive    = true,
  activeClass = 'bg-ci-gray-700 hover:bg-ci-gray-600 text-white',
  inactiveClass = 'bg-red-500 hover:bg-red-600 text-white',
  customClass = '',
  badge       = null,
  pulse       = false,
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          relative w-12 h-12 rounded-full flex items-center justify-center
          transition-all duration-200 active:scale-95 focus:outline-none
          focus:ring-2 focus:ring-ci-orange focus:ring-offset-2
          focus:ring-offset-ci-gray-900
          ${customClass || (isActive ? activeClass : inactiveClass)}
          ${pulse ? 'animate-pulse' : ''}
        `}
        title={title}
        aria-label={title}
      >
        {children}

        {/* Badge non-lus / compteur */}
        {badge !== null && badge > 0 && (
          <span className="
            absolute -top-1 -right-1 min-w-[18px] h-[18px]
            bg-ci-orange text-white text-[10px] font-bold
            rounded-full flex items-center justify-center px-1
            border-2 border-ci-gray-900
          ">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="
          absolute bottom-14 left-1/2 -translate-x-1/2
          bg-gray-900 text-white text-xs font-semibold
          px-2.5 py-1.5 rounded-lg whitespace-nowrap
          border border-ci-gray-700 shadow-xl
          pointer-events-none z-50
          before:content-[''] before:absolute before:top-full
          before:left-1/2 before:-translate-x-1/2
          before:border-4 before:border-transparent
          before:border-t-gray-900
        ">
          {title}
        </div>
      )}
    </div>
  );
};

// ============================================================
//  COMPOSANT PRINCIPAL
// ============================================================
const Controls = ({
  // ── États médias ──
  isAudioEnabled    = true,
  isVideoEnabled    = true,
  isScreenSharing   = false,

  // ── États UI ──
  isChatOpen        = false,
  isHandRaised      = false,
  isParticipantsOpen = false,

  // ── Données ──
  participantsCount = 1,
  unreadMessages    = 0,
  roomName          = 'EduConf CI',
  roomId            = null,
  sessionStartedAt  = null,
  isHost            = false,
  attendanceLoading = false,

  // ── Callbacks ──
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onToggleHand,
  onToggleParticipants,
  onLeaveRoom,
  onMuteAllMics,
  onDisableAllCameras,
  onGenerateAttendance,
}) => {
  const timerStorageKey = `room_session_started_at_${roomId || roomName}`;
  const timer = useSessionTimer(sessionStartedAt, timerStorageKey);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showHostActions, setShowHostActions] = useState(false);

  // ── Confirmation quitter ──
  const handleLeaveClick = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setShowLeaveConfirm(false);
    onLeaveRoom?.();
  }, [onLeaveRoom]);

  const handleCancelLeave = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  // ── Raccourcis clavier ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorer si on est dans un input/textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.key.toLowerCase()) {
        case 'm': onToggleAudio?.();       break;  // M → Micro
        case 'v': onToggleVideo?.();       break;  // V → Vidéo
        case 's': onToggleScreenShare?.(); break;  // S → Screen
        case 'c': onToggleChat?.();        break;  // C → Chat
        case 'h': onToggleHand?.();        break;  // H → Main
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleAudio, onToggleVideo, onToggleScreenShare, onToggleChat, onToggleHand]);

  return (
    <>
      {/* ============================================================
          MODAL DE CONFIRMATION — Quitter
      ============================================================ */}
      {showHostActions && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-ci-gray-900 border border-ci-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="h-1 w-full bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mb-5" />
            <div className="text-center mb-5">
              <h3 className="text-white text-lg font-bold mb-1">Options hote</h3>
              <p className="text-ci-gray-400 text-sm">Gestion globale des participants</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  onMuteAllMics?.();
                  setShowHostActions(false);
                }}
                className="w-full py-2.5 rounded-xl bg-ci-orange hover:bg-orange-600 text-white font-semibold text-sm"
              >
                Couper tous les micros
              </button>
              <button
                onClick={() => {
                  onDisableAllCameras?.();
                  setShowHostActions(false);
                }}
                className="w-full py-2.5 rounded-xl bg-ci-green hover:bg-green-700 text-white font-semibold text-sm"
              >
                Couper toutes les cameras
              </button>
              <button
                onClick={() => onGenerateAttendance?.()}
                disabled={attendanceLoading}
                className="w-full py-2.5 rounded-xl border border-ci-gray-600 text-white font-semibold text-sm hover:bg-ci-gray-700 disabled:opacity-60"
              >
                {attendanceLoading ? 'Generation...' : 'Generer la liste de presence'}
              </button>
              <button
                onClick={() => setShowHostActions(false)}
                className="w-full py-2.5 rounded-xl border border-ci-gray-700 text-ci-gray-300 text-sm hover:bg-ci-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="
            bg-ci-gray-900 border border-ci-gray-700
            rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl
            animate-[fadeIn_0.2s_ease]
          ">
            {/* Bandeau drapeau */}
            <div className="h-1 w-full bg-gradient-to-r from-ci-orange via-white to-ci-green rounded-full mb-5" />

            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🐘</div>
              <h3 className="text-white text-lg font-bold mb-1">
                Quitter la salle ?
              </h3>
              <p className="text-ci-gray-400 text-sm">
                Vous allez être déconnecté de{' '}
                <span className="text-ci-orange font-semibold">{roomName}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className="
                  flex-1 py-2.5 rounded-xl border border-ci-gray-600
                  text-white text-sm font-semibold
                  hover:bg-ci-gray-700 transition-all duration-200
                "
              >
                Rester
              </button>
              <button
                onClick={handleConfirmLeave}
                className="
                  flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700
                  text-white text-sm font-bold
                  transition-all duration-200
                "
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          BARRE DE CONTRÔLES
      ============================================================ */}
      <div className="fixed bottom-0 left-0 right-0 z-50">

        {/* ── Bandeau drapeau 🇨🇮 ── */}
        <div className="h-1 bg-gradient-to-r from-ci-orange via-white to-ci-green" />

        <div className="bg-ci-gray-900/95 backdrop-blur-md border-t border-ci-gray-700/60 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">

            {/* ════════════════════════════════
                GAUCHE — Infos salle + Timer
            ════════════════════════════════ */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex flex-col">
                <span className="text-ci-orange font-bold text-sm truncate">
                  🐘 {roomName}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-ci-gray-400 text-xs font-mono tracking-widest">
                    ⏱ {timer}
                  </span>
                  <span className="text-ci-gray-500 text-xs">•</span>
                  <span className="text-ci-gray-400 text-xs">
                    👥 {participantsCount}
                  </span>
                </div>
              </div>

              {/* Mobile : infos compactes */}
              <div className="flex sm:hidden items-center gap-2">
                <span className="text-ci-orange font-bold text-xs">🐘</span>
                <span className="text-ci-gray-400 text-xs font-mono">
                  {timer}
                </span>
              </div>
            </div>

            {/* ════════════════════════════════
                CENTRE — Contrôles principaux
            ════════════════════════════════ */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* 🎤 Micro */}
              <ControlButton
                onClick={onToggleAudio}
                title={isAudioEnabled ? 'Couper le micro (M)' : 'Activer le micro (M)'}
                isActive={isAudioEnabled}
                activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                inactiveClass="bg-red-500 hover:bg-red-600 text-white"
              >
                {isAudioEnabled ? <Icons.MicOn /> : <Icons.MicOff />}
              </ControlButton>

              {/* 📷 Caméra */}
              <ControlButton
                onClick={onToggleVideo}
                title={isVideoEnabled ? 'Couper la caméra (V)' : 'Activer la caméra (V)'}
                isActive={isVideoEnabled}
                activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                inactiveClass="bg-red-500 hover:bg-red-600 text-white"
              >
                {isVideoEnabled ? <Icons.VideoOn /> : <Icons.VideoOff />}
              </ControlButton>

              {/* 🖥️ Partage d'écran */}
              <ControlButton
                onClick={onToggleScreenShare}
                title={isScreenSharing ? "Arrêter le partage (S)" : "Partager l'écran (S)"}
                isActive={!isScreenSharing}
                activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                inactiveClass="bg-ci-green hover:bg-green-700 text-white"
                pulse={isScreenSharing}
              >
                {isScreenSharing ? <Icons.ScreenOn /> : <Icons.ScreenOff />}
              </ControlButton>

              {/* 📞 Quitter — Bouton central rouge proéminent */}
              <ControlButton
                onClick={handleLeaveClick}
                title="Quitter la salle"
                customClass="
                  bg-red-600 hover:bg-red-700 text-white
                  w-14 h-12 rounded-2xl shadow-lg shadow-red-900/40
                  hover:shadow-red-900/60
                "
              >
                <Icons.Leave />
              </ControlButton>

            </div>

            {/* ════════════════════════════════
                DROITE — Chat + Participants + Main
            ════════════════════════════════ */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* ✋ Lever la main */}
              <ControlButton
                onClick={onToggleHand}
                title={isHandRaised ? 'Baisser la main (H)' : 'Lever la main (H)'}
                isActive={!isHandRaised}
                activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                inactiveClass="bg-ci-orange hover:bg-orange-600 text-white"
              >
                <Icons.HandOn />
              </ControlButton>

              {/* 👥 Participants */}
              <ControlButton
                onClick={onToggleParticipants}
                title={`Participants (${participantsCount})`}
                isActive={!isParticipantsOpen}
                activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                inactiveClass="bg-ci-green hover:bg-green-700 text-white"
                badge={participantsCount}
              >
                <Icons.Participants />
              </ControlButton>

              {/* 💬 Chat */}
              <ControlButton
                onClick={onToggleChat}
                title={isChatOpen ? 'Fermer le chat (C)' : 'Ouvrir le chat (C)'}
                isActive={!isChatOpen}
                activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                inactiveClass="bg-ci-green hover:bg-green-700 text-white"
                badge={unreadMessages}
              >
                <Icons.Chat />
              </ControlButton>

              {isHost && (
                <ControlButton
                  onClick={() => setShowHostActions(true)}
                  title="Options hote"
                  isActive={true}
                  activeClass="bg-ci-gray-700 hover:bg-ci-gray-600 text-white"
                >
                  <Icons.More />
                </ControlButton>
              )}

            </div>
          </div>

          {/* ── Légende raccourcis clavier (desktop) ── */}
          <div className="hidden lg:flex justify-center mt-2 gap-4">
            {[
              { key: 'M', label: 'Micro' },
              { key: 'V', label: 'Vidéo' },
              { key: 'S', label: 'Écran' },
              { key: 'C', label: 'Chat' },
              { key: 'H', label: 'Main' },
            ].map(({ key, label }) => (
              <span key={key} className="text-ci-gray-600 text-[10px] flex items-center gap-1">
                <kbd className="
                  bg-ci-gray-800 border border-ci-gray-700
                  text-ci-gray-400 text-[9px] font-mono
                  px-1.5 py-0.5 rounded
                ">{key}</kbd>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Controls;
