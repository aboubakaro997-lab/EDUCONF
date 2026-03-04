import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room as LiveKitRoom,
  RoomEvent,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
} from 'livekit-client';

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const DEFAULT_LIVEKIT_URL =
  process.env.REACT_APP_LIVEKIT_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'ws://localhost:7880');

const DEBUG_WEBRTC = process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (DEBUG_WEBRTC) console.log(...args);
};
const debugWarn = (...args) => {
  if (DEBUG_WEBRTC) console.warn(...args);
};

const useWebRTC = (socket, roomId, userName, userId = null) => {
  const livekitRoomRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const screenTrackRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [mediaError, setMediaError] = useState(null);

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

  const refreshLocalStream = useCallback(() => {
    const mediaTracks = [];
    const audioTrack = localAudioTrackRef.current;
    const videoTrack = screenTrackRef.current || localVideoTrackRef.current;

    if (audioTrack && !audioTrack.isMuted) {
      mediaTracks.push(audioTrack.mediaStreamTrack);
    }
    if (videoTrack && !videoTrack.isMuted) {
      mediaTracks.push(videoTrack.mediaStreamTrack);
    }

    setLocalStream(mediaTracks.length ? new MediaStream(mediaTracks) : null);
  }, []);

  const upsertRemoteParticipantStream = useCallback((participant) => {
    const tracks = [];
    participant.trackPublications.forEach((publication) => {
      if (!publication?.isSubscribed || !publication.track) return;
      const kind = publication.track.kind;
      if (kind !== 'audio' && kind !== 'video') return;
      if (publication.track.mediaStreamTrack) {
        tracks.push(publication.track.mediaStreamTrack);
      }
    });

    const peerId = participant.identity || participant.sid;
    if (!peerId) return;

    if (!tracks.length) {
      setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId));
      return;
    }

    const stream = new MediaStream(tracks);
    setRemoteStreams((prev) => {
      const idx = prev.findIndex((s) => s.peerId === peerId);
      const nextItem = {
        peerId,
        stream,
        userName: participant.name || participant.identity || 'Participant',
      };
      if (idx === -1) return [...prev, nextItem];
      const copy = [...prev];
      copy[idx] = nextItem;
      return copy;
    });
  }, []);

  const removeRemoteParticipant = useCallback((participant) => {
    const peerId = participant?.identity || participant?.sid;
    if (!peerId) return;
    setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId));
  }, []);

  const fetchSfuToken = useCallback(async () => {
    if (!roomId) throw new Error('roomId manquant pour SFU');
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) throw new Error('Token d authentification manquant');

    const response = await fetch(`${API_BASE_URL}/sfu/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ room_id: Number(roomId) }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.detail || 'Impossible d obtenir le token SFU');
    }

    return response.json();
  }, [roomId]);

  const ensureLocalTracksPublished = useCallback(async (livekitRoom) => {
    try {
      if (!localAudioTrackRef.current) {
        localAudioTrackRef.current = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
        });
        await livekitRoom.localParticipant.publishTrack(localAudioTrackRef.current);
      }

      if (!localVideoTrackRef.current) {
        localVideoTrackRef.current = await createLocalVideoTrack({
          resolution: { width: 1280, height: 720, frameRate: 30 },
          facingMode: 'user',
        });
        await livekitRoom.localParticipant.publishTrack(localVideoTrackRef.current);
      }

      setIsAudioEnabled(!localAudioTrackRef.current.isMuted);
      setIsVideoEnabled(!localVideoTrackRef.current.isMuted);
      setMediaError(null);
      refreshLocalStream();
    } catch (err) {
      setMediaError(getMediaErrorMessage(err));
      console.error('Erreur initialisation tracks locales:', err);
    }
  }, [refreshLocalStream]);

  const connectLiveKit = useCallback(async () => {
    if (livekitRoomRef.current) return livekitRoomRef.current;

    const tokenPayload = await fetchSfuToken();
    const livekitUrl = tokenPayload.livekit_url || DEFAULT_LIVEKIT_URL;
    if (!livekitUrl) {
      throw new Error('LIVEKIT URL manquante');
    }

    const room = new LiveKitRoom({
      adaptiveStream: true,
      dynacast: true,
    });

    room
      .on(RoomEvent.TrackSubscribed, (_track, _pub, participant) => {
        upsertRemoteParticipantStream(participant);
      })
      .on(RoomEvent.TrackUnsubscribed, (_track, _pub, participant) => {
        upsertRemoteParticipantStream(participant);
      })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        upsertRemoteParticipantStream(participant);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        removeRemoteParticipant(participant);
      })
      .on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication?.source === 'screen_share') {
          screenTrackRef.current = null;
          setIsScreenSharing(false);
          refreshLocalStream();
        }
      });

    await room.connect(livekitUrl, tokenPayload.token);
    livekitRoomRef.current = room;

    await ensureLocalTracksPublished(room);

    room.remoteParticipants.forEach((participant) => {
      upsertRemoteParticipantStream(participant);
    });

    debugLog('Connecte au SFU LiveKit room=', tokenPayload.room_name, 'url=', livekitUrl);
    return room;
  }, [
    ensureLocalTracksPublished,
    fetchSfuToken,
    refreshLocalStream,
    removeRemoteParticipant,
    upsertRemoteParticipantStream,
  ]);

  const disconnectLiveKit = useCallback(() => {
    const room = livekitRoomRef.current;
    if (room) {
      room.disconnect();
      livekitRoomRef.current = null;
    }

    [screenTrackRef.current, localVideoTrackRef.current, localAudioTrackRef.current].forEach((track) => {
      if (!track) return;
      try {
        track.stop();
      } catch (_) {}
    });

    screenTrackRef.current = null;
    localVideoTrackRef.current = null;
    localAudioTrackRef.current = null;

    setLocalStream(null);
    setRemoteStreams([]);
    setIsScreenSharing(false);
  }, []);

  const emitMediaState = useCallback((audio, video) => {
    socket?.emit('media_state_change', {
      roomId,
      audio,
      video,
    });
  }, [socket, roomId]);

  const joinRoom = useCallback(async () => {
    if (!socket?.connected) {
      debugWarn('Socket non connecte');
      return;
    }

    await new Promise((resolve) => {
      socket.emit('join_room', { roomId, userName, userId }, (response) => {
        if (response?.error) {
          console.error('Erreur join_room:', response.error);
          setMediaError(response.error);
          return resolve();
        }

        setParticipants(normalizeParticipants(response.participants || []));
        resolve();
      });
    });

    try {
      await connectLiveKit();
      emitMediaState(isAudioEnabled, isVideoEnabled);
    } catch (err) {
      console.error('Erreur connexion SFU:', err);
      setMediaError(getMediaErrorMessage(err));
    }
  }, [
    socket,
    roomId,
    userName,
    userId,
    normalizeParticipants,
    connectLiveKit,
    emitMediaState,
    isAudioEnabled,
    isVideoEnabled,
  ]);

  const leaveRoom = useCallback(() => {
    socket?.emit('leave_room', { roomId });
    disconnectLiveKit();
    setParticipants([]);
    setMediaError(null);
  }, [socket, roomId, disconnectLiveKit]);

  const toggleAudio = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (!room) return;

    try {
      if (!localAudioTrackRef.current) {
        localAudioTrackRef.current = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
        });
        await room.localParticipant.publishTrack(localAudioTrackRef.current);
      }

      const track = localAudioTrackRef.current;
      if (track.isMuted) {
        await track.unmute();
        setIsAudioEnabled(true);
        emitMediaState(true, isVideoEnabled);
      } else {
        await track.mute();
        setIsAudioEnabled(false);
        emitMediaState(false, isVideoEnabled);
      }
      refreshLocalStream();
    } catch (err) {
      console.error('Impossible de basculer audio:', err);
      setMediaError(getMediaErrorMessage(err));
    }
  }, [emitMediaState, isVideoEnabled, refreshLocalStream]);

  const toggleVideo = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (!room) return;

    try {
      if (!localVideoTrackRef.current) {
        localVideoTrackRef.current = await createLocalVideoTrack({
          resolution: { width: 1280, height: 720, frameRate: 30 },
          facingMode: 'user',
        });
        await room.localParticipant.publishTrack(localVideoTrackRef.current);
      }

      const track = localVideoTrackRef.current;
      if (track.isMuted) {
        await track.unmute();
        setIsVideoEnabled(true);
        emitMediaState(isAudioEnabled, true);
      } else {
        await track.mute();
        setIsVideoEnabled(false);
        emitMediaState(isAudioEnabled, false);
      }
      refreshLocalStream();
    } catch (err) {
      console.error('Impossible de basculer video:', err);
      setMediaError(getMediaErrorMessage(err));
    }
  }, [emitMediaState, isAudioEnabled, refreshLocalStream]);

  const toggleScreenShare = useCallback(async () => {
    const room = livekitRoomRef.current;
    if (!room) return;

    try {
      if (screenTrackRef.current) {
        await room.localParticipant.unpublishTrack(screenTrackRef.current);
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
        setIsScreenSharing(false);
        refreshLocalStream();
        return;
      }

      const screenTracks = await createLocalScreenTracks({ audio: false });
      const videoScreenTrack = screenTracks.find((t) => t.kind === 'video');
      if (!videoScreenTrack) return;

      await room.localParticipant.publishTrack(videoScreenTrack);
      screenTrackRef.current = videoScreenTrack;
      setIsScreenSharing(true);
      refreshLocalStream();

      videoScreenTrack.mediaStreamTrack.onended = async () => {
        try {
          await room.localParticipant.unpublishTrack(videoScreenTrack);
        } catch (_) {}
        screenTrackRef.current = null;
        setIsScreenSharing(false);
        refreshLocalStream();
      };
    } catch (err) {
      console.error('Erreur partage ecran:', err);
      setMediaError(getMediaErrorMessage(err));
    }
  }, [refreshLocalStream]);

  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ participants: list }) => {
      setParticipants(normalizeParticipants(list || []));
    };
    const onUserLeft = ({ participants: list }) => {
      setParticipants(normalizeParticipants(list || []));
    };
    const onMediaStateChange = ({ userId: sid, audio, video }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.sid === sid ? { ...p, audio, video } : p))
      );
    };
    const onHostForceMedia = async ({ audio, video }) => {
      try {
        if (audio === false && localAudioTrackRef.current && !localAudioTrackRef.current.isMuted) {
          await localAudioTrackRef.current.mute();
          setIsAudioEnabled(false);
        }
        if (video === false && localVideoTrackRef.current && !localVideoTrackRef.current.isMuted) {
          await localVideoTrackRef.current.mute();
          setIsVideoEnabled(false);
        }
        refreshLocalStream();
      } catch (err) {
        console.error('Erreur host_force_media:', err);
      }
    };

    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('media_state_change', onMediaStateChange);
    socket.on('host_force_media', onHostForceMedia);

    return () => {
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('media_state_change', onMediaStateChange);
      socket.off('host_force_media', onHostForceMedia);
    };
  }, [normalizeParticipants, refreshLocalStream, socket]);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

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

const getMediaErrorMessage = (error) => {
  const messages = {
    NotFoundError: 'Aucun peripherique audio/video detecte',
    NotAllowedError: 'Acces refuse - autorisez camera/micro',
    NotReadableError: 'Peripherique occupe par une autre application',
    OverconstrainedError: 'Contraintes medias non supportees',
    SecurityError: 'HTTPS requis pour acceder aux medias',
  };
  return messages[error?.name] || error?.message || 'Erreur media';
};

export default useWebRTC;
