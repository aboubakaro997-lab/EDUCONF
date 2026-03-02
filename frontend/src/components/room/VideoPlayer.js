import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  FaMicrophoneSlash,
  FaVideoSlash,
  FaUser,
  FaVolumeUp
} from 'react-icons/fa';

// ============================================================
//  ANIMATIONS
// ============================================================
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 0, 0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(255, 107, 0, 0); }
`;

// ============================================================
//  STYLED COMPONENTS — Thème Ivoirien 🇨🇮
// ============================================================
const PlayerWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 180px;
  background: #1a1a2e;
  border-radius: 12px;
  overflow: hidden;
  animation: ${fadeIn} 0.4s ease;
  border: 2px solid ${({ $isLocal, $isSpeaking }) =>
    $isSpeaking ? '#FF6B00' : $isLocal ? '#009A00' : '#2a2a4a'};
  transition: border-color 0.3s ease;

  ${({ $isSpeaking }) => $isSpeaking && `
    animation: ${pulse} 1.5s infinite;
  `}
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  display: ${({ $hidden }) => $hidden ? 'none' : 'block'};
  transform: ${({ $isLocal }) => $isLocal ? 'scaleX(-1)' : 'none'};
`;

const AvatarPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  gap: 12px;
`;

const AvatarCircle = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FF6B00, #FF8C00);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 4px 15px rgba(255, 107, 0, 0.4);
  border: 3px solid rgba(255, 255, 255, 0.2);
`;

const AvatarName = styled.span`
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  font-weight: 500;
  letter-spacing: 0.5px;
`;

const NameTag = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 75%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LocalBadge = styled.span`
  background: #009A00;
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 700;
`;

const StatusIcons = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 6px;
`;

const StatusIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(220, 50, 50, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  backdrop-filter: blur(4px);
`;

const SpeakingIndicator = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 107, 0, 0.85);
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  color: #fff;
  font-weight: 600;
`;

// ============================================================
//  COMPOSANT
// ============================================================
const VideoPlayer = ({
  stream,
  isLocal     = false,
  userName    = 'Participant',
  isAudioOn   = true,
  isVideoOn   = true,
  isSpeaking  = false,
  className,
}) => {
  const videoRef  = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Attacher le flux à la balise vidéo
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => setIsLoaded(true);
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  const showAvatar = !stream || !isVideoOn || !isLoaded;
  const initials   = userName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <PlayerWrapper
      $isLocal={isLocal}
      $isSpeaking={isSpeaking}
      className={className}
    >
      {/* ── Vidéo ── */}
      <Video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}  // Muter la vidéo locale pour éviter l'écho
        $isLocal={isLocal}
        $hidden={showAvatar}
      />

      {/* ── Avatar si pas de vidéo ── */}
      {showAvatar && (
        <AvatarPlaceholder>
          <AvatarCircle>
            {initials || <FaUser />}
          </AvatarCircle>
          <AvatarName>{userName}</AvatarName>
        </AvatarPlaceholder>
      )}

      {/* ── Indicateur de parole ── */}
      {isSpeaking && isAudioOn && (
        <SpeakingIndicator>
          <FaVolumeUp size={10} />
          <span>Parle...</span>
        </SpeakingIndicator>
      )}

      {/* ── Icônes d'état ── */}
      <StatusIcons>
        {!isAudioOn && (
          <StatusIcon title="Micro désactivé">
            <FaMicrophoneSlash size={11} />
          </StatusIcon>
        )}
        {!isVideoOn && (
          <StatusIcon title="Caméra désactivée">
            <FaVideoSlash size={11} />
          </StatusIcon>
        )}
      </StatusIcons>

      {/* ── Badge nom ── */}
      <NameTag>
        {userName}
        {isLocal && <LocalBadge>Vous</LocalBadge>}
      </NameTag>
    </PlayerWrapper>
  );
};

export default VideoPlayer;
