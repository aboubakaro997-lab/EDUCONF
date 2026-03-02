import React, { useMemo } from 'react';
import styled from 'styled-components';
import VideoPlayer from './VideoPlayer';

// ============================================================
//  LOGIQUE DE GRILLE DYNAMIQUE
// ============================================================
const getGridConfig = (count) => {
  if (count === 1)  return { cols: 1, rows: 1 };
  if (count === 2)  return { cols: 2, rows: 1 };
  if (count <= 4)   return { cols: 2, rows: 2 };
  if (count <= 6)   return { cols: 3, rows: 2 };
  if (count <= 9)   return { cols: 3, rows: 3 };
  return            { cols: 4, rows: Math.ceil(count / 4) };
};

// ============================================================
//  STYLED COMPONENTS
// ============================================================
const GridContainer = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: ${({ $cols }) => `repeat(${$cols}, 1fr)`};
  grid-template-rows: ${({ $rows }) => `repeat(${$rows}, 1fr)`};
  gap: 10px;
  padding: 10px;
  background: #0d0d1a;
  overflow: hidden;
  box-sizing: border-box;

  @media (max-width: 768px) {
    grid-template-columns: ${({ $cols }) =>
      $cols > 2 ? 'repeat(2, 1fr)' : `repeat(${$cols}, 1fr)`};
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const LocalPlayerWrapper = styled.div`
  position: absolute;
  bottom: 80px;
  right: 16px;
  width: 180px;
  height: 120px;
  z-index: 10;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  border: 2px solid #FF6B00;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    width: 220px;
    height: 145px;
  }

  @media (max-width: 480px) {
    width: 130px;
    height: 90px;
    bottom: 90px;
    right: 8px;
  }
`;

const EmptyRoom = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
  color: rgba(255,255,255,0.4);
`;

const ElephantEmoji = styled.div`
  font-size: 64px;
  filter: grayscale(0.3);
`;

const EmptyText = styled.p`
  font-size: 16px;
  font-weight: 500;
  color: rgba(255,255,255,0.5);
  text-align: center;
`;

const ParticipantCount = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,107,0,0.4);
  z-index: 5;
`;

// ============================================================
//  COMPOSANT
// ============================================================
const VideoGrid = ({
  localStream,
  remoteStreams   = [],
  participants    = [],
  localUser,
  isLocalAudioOn  = true,
  isLocalVideoOn  = true,
  speakingPeers   = [],
}) => {

  // Nombre total : local + distants
  const totalStreams  = 1 + remoteStreams.length;
  const { cols, rows } = useMemo(() => getGridConfig(totalStreams), [totalStreams]);

  // Mode PiP si 1 seul participant distant
  const usePipMode = remoteStreams.length === 1;

  // Trouver un participant par peerId
  const getParticipant = (peerId) =>
    participants.find(p => p.sid === peerId || p.socketId === peerId);

  if (remoteStreams.length === 0 && !localStream) {
    return (
      <EmptyRoom>
        <ElephantEmoji>🐘</ElephantEmoji>
        <EmptyText>
          Salle vide — En attente de participants...
        </EmptyText>
      </EmptyRoom>
    );
  }

  // ── Mode Picture-in-Picture (1 distant) ──
  if (usePipMode) {
    const remote = remoteStreams[0];
    const remoteParticipant = getParticipant(remote.peerId);

    return (
      <>
        {/* Flux distant en plein écran */}
        <VideoPlayer
          stream={remote.stream}
          isLocal={false}
          userName={remoteParticipant?.userName || 'Participant'}
          isAudioOn={remoteParticipant?.audio !== false}
          isVideoOn={remoteParticipant?.video !== false}
          isSpeaking={speakingPeers.includes(remote.peerId)}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Flux local en PiP */}
        <LocalPlayerWrapper>
          <VideoPlayer
            stream={localStream}
            isLocal
            userName={localUser?.username || 'Vous'}
            isAudioOn={isLocalAudioOn}
            isVideoOn={isLocalVideoOn}
          />
        </LocalPlayerWrapper>

        <ParticipantCount>👥 2 participants</ParticipantCount>
      </>
    );
  }

  // ── Mode Grille (plusieurs participants) ──
  return (
    <>
      <GridContainer $cols={cols} $rows={rows}>
        {/* Flux local */}
        <VideoPlayer
          stream={localStream}
          isLocal
          userName={localUser?.username || 'Vous'}
          isAudioOn={isLocalAudioOn}
          isVideoOn={isLocalVideoOn}
        />

        {/* Flux distants */}
        {remoteStreams.map(({ peerId, stream }) => {
          const participant = getParticipant(peerId);
          return (
            <VideoPlayer
              key={peerId}
              stream={stream}
              isLocal={false}
              userName={participant?.userName || `Participant`}
              isAudioOn={participant?.audio !== false}
              isVideoOn={participant?.video !== false}
              isSpeaking={speakingPeers.includes(peerId)}
            />
          );
        })}
      </GridContainer>

      <ParticipantCount>
        👥 {totalStreams} participant{totalStreams > 1 ? 's' : ''}
      </ParticipantCount>
    </>
  );
};

export default VideoGrid;
