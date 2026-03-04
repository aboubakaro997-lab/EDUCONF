from datetime import datetime
from typing import Optional

import socketio
from jose import JWTError, jwt

from app import models
from app.config import settings
from app.database import SessionLocal


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins,
    logger=True,
    engineio_logger=False,
)

rooms_data = {}
chat_history = {}
sid_user_ids = {}
room_host_presence = {}
MAX_HISTORY = 200


def get_room_participants(room_id: str):
    return rooms_data.get(room_id, {})


def get_room_messages(room_id: str):
    return chat_history.get(room_id, [])


def _resolve_room_id(raw_room_id):
    if raw_room_id is None:
        return None
    room_str = str(raw_room_id).strip()
    if not room_str.isdigit():
        return None
    return int(room_str)


def _can_access_room(user_id: int, room_id: int) -> bool:
    db = SessionLocal()
    try:
        room = db.query(models.Room).filter(
            models.Room.id == room_id,
            models.Room.is_active == True,
        ).first()
        if not room:
            return False

        participant = db.query(models.Participant).filter(
            models.Participant.room_id == room_id,
            models.Participant.user_id == user_id,
        ).first()
        return participant is not None
    finally:
        db.close()


def _is_host(user_id: int, room_id: int) -> bool:
    db = SessionLocal()
    try:
        room = db.query(models.Room).filter(models.Room.id == room_id).first()
        return bool(room and room.host_id == user_id)
    finally:
        db.close()


def _resolve_user_name(user_id: int) -> str:
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return "Anonyme"
        return user.full_name or user.username
    finally:
        db.close()


def _open_room_session(room_id: int, user_id: int, socket_id: str) -> str:
    session_socket_id = f"{socket_id}:{room_id}:{int(datetime.utcnow().timestamp() * 1000)}"
    db = SessionLocal()
    try:
        session = models.RoomSession(
            room_id=room_id,
            user_id=user_id,
            socket_id=session_socket_id,
            joined_at=datetime.utcnow(),
            left_at=None,
        )
        db.add(session)
        db.commit()
        return session_socket_id
    finally:
        db.close()


def _close_room_session(session_socket_id: Optional[str]) -> None:
    if not session_socket_id:
        return
    db = SessionLocal()
    try:
        session = db.query(models.RoomSession).filter(
            models.RoomSession.socket_id == session_socket_id,
            models.RoomSession.left_at.is_(None),
        ).first()
        if session:
            session.left_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


def _is_sid_in_room(sid: str, room_id: str) -> bool:
    return sid in rooms_data.get(room_id, {})


def _extract_user_id_from_auth(auth_payload):
    if not isinstance(auth_payload, dict):
        return None
    token = auth_payload.get("token")
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


@sio.event
async def connect(sid, environ, auth=None):
    user_id = _extract_user_id_from_auth(auth)
    if user_id is None:
        return False
    sid_user_ids[sid] = user_id
    print(f"Socket connected sid={sid} user_id={user_id}")


@sio.event
async def disconnect(sid):
    sid_user_ids.pop(sid, None)

    for room_id, participants in list(rooms_data.items()):
        if sid in participants:
            user_info = participants.pop(sid)
            disconnected_user_id = user_info.get("userId")
            _close_room_session(user_info.get("sessionSocketId"))
            await sio.emit(
                "user_left",
                {
                    "userId": sid,
                    "userName": user_info.get("userName", "Inconnu"),
                    "participants": list(participants.values()),
                },
                room=room_id,
            )
            await sio.leave_room(sid, room_id)

            room_id_int = _resolve_room_id(room_id)
            if (
                room_id_int is not None
                and disconnected_user_id is not None
                and _is_host(disconnected_user_id, room_id_int)
            ):
                host_still_present = any(
                    info.get("userId") == disconnected_user_id
                    for info in participants.values()
                )
                if not host_still_present:
                    room_host_presence[room_id] = False
                    await sio.emit(
                        "host_status",
                        {
                            "roomId": room_id,
                            "hostUserId": disconnected_user_id,
                            "present": False,
                        },
                        room=room_id,
                    )

            if not participants:
                room_host_presence.pop(room_id, None)
                del rooms_data[room_id]
            break


@sio.event
async def join_room(sid, data):
    room_id_raw = data.get("roomId")
    user_name = data.get("userName", "Anonyme")
    user_id = sid_user_ids.get(sid)

    print(f"🔍 join_room: sid={sid}, user_id={user_id}, room_id_raw={room_id_raw}, user_name={user_name}")

    if user_id is None:
        print(f"   ❌ Unauthorized - no user_id for sid={sid}")
        return {"error": "Unauthorized"}

    room_id_int = _resolve_room_id(room_id_raw)
    if room_id_int is None:
        print(f"   ❌ Invalid room_id")
        return {"error": "room_id requis"}
    room_id = str(room_id_int)

    if not _can_access_room(user_id, room_id_int):
        print(f"   ❌ Access denied for user_id={user_id} to room={room_id_int}")
        return {"error": "Acces refuse a cette salle"}
    
    print(f"   ✅ Access granted")

    resolved_user_name = _resolve_user_name(user_id) or user_name

    if room_id not in rooms_data:
        rooms_data[room_id] = {}
        print(f"   📝 Created new room data for room_id={room_id}")
    else:
        print(f"   📝 Existing room, current participants: {list(rooms_data[room_id].keys())}")

    stale_sids = []
    for existing_sid, info in rooms_data[room_id].items():
        same_user_id = info.get("userId") == user_id
        if existing_sid != sid and same_user_id:
            stale_sids.append(existing_sid)

    for stale_sid in stale_sids:
        rooms_data[room_id].pop(stale_sid, None)
        try:
            await sio.leave_room(stale_sid, room_id)
        except Exception:
            pass

    session_socket_id = _open_room_session(room_id_int, user_id, sid)
    rooms_data[room_id][sid] = {
        "sid": sid,
        "userId": user_id,
        "userName": resolved_user_name,
        "sessionSocketId": session_socket_id,
        "joinedAt": datetime.now().isoformat(),
    }

    await sio.enter_room(sid, room_id)
    print(f"   ✅ Joined room, now participants: {list(rooms_data[room_id].keys())}")

    await sio.emit(
        "user_joined",
        {
            "userId": sid,
            "userName": resolved_user_name,
            "participants": list(rooms_data[room_id].values()),
        },
        room=room_id,
        skip_sid=sid,
    )

    if _is_host(user_id, room_id_int):
        previously_present = room_host_presence.get(room_id, False)
        room_host_presence[room_id] = True
        if not previously_present:
            await sio.emit(
                "host_status",
                {
                    "roomId": room_id,
                    "hostUserId": user_id,
                    "present": True,
                },
                room=room_id,
            )

    print(f"   ✅ join_room complete, returning {len(rooms_data[room_id])} participants")
    return {"success": True, "participants": list(rooms_data[room_id].values())}


@sio.event
async def leave_room(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    room_id = str(room_id_int) if room_id_int is not None else None

    if room_id and room_id in rooms_data:
        user_info = rooms_data[room_id].pop(sid, {})
        leaving_user_id = user_info.get("userId")
        _close_room_session(user_info.get("sessionSocketId"))
        await sio.emit(
            "user_left",
            {
                "userId": sid,
                "userName": user_info.get("userName", "Inconnu"),
                "participants": list(rooms_data[room_id].values()),
            },
            room=room_id,
        )
        await sio.leave_room(sid, room_id)

        if room_id_int is not None and leaving_user_id is not None and _is_host(leaving_user_id, room_id_int):
            host_still_present = any(
                info.get("userId") == leaving_user_id
                for info in rooms_data[room_id].values()
            )
            if not host_still_present:
                room_host_presence[room_id] = False
                await sio.emit(
                    "host_status",
                    {
                        "roomId": room_id,
                        "hostUserId": leaving_user_id,
                        "present": False,
                    },
                    room=room_id,
                )

        if not rooms_data[room_id]:
            room_host_presence.pop(room_id, None)
            del rooms_data[room_id]


@sio.event
async def webrtc_offer(sid, data):
    target_sid = data.get("targetId")
    offer = data.get("offer")
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return {"error": "roomId requis"}
    room_id = str(room_id_int)

    print(f"🔍 webrtc_offer: from={sid} to={target_sid} room={room_id}")
    print(f"   room participants: {list(rooms_data.get(room_id, {}).keys())}")
    
    if not _is_sid_in_room(sid, room_id):
        print(f"   ❌ Sender {sid} not in room {room_id}")
        return {"error": "Acces WebRTC refuse - sender not in room"}
    
    if target_sid not in rooms_data.get(room_id, {}):
        print(f"   ❌ Target {target_sid} not in room {room_id}")
        return {"error": "Acces WebRTC refuse - target not in room"}

    await sio.emit(
        "webrtc_offer",
        {
            "offer": offer,
            "fromId": sid,
            "roomId": room_id,
        },
        to=target_sid,
    )
    print(f"   ✅ Offer forwarded to {target_sid}")


@sio.event
async def webrtc_answer(sid, data):
    target_sid = data.get("targetId")
    answer = data.get("answer")
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return {"error": "roomId requis"}
    room_id = str(room_id_int)

    print(f"🔍 webrtc_answer: from={sid} to={target_sid} room={room_id}")
    
    if not _is_sid_in_room(sid, room_id):
        print(f"   ❌ Sender {sid} not in room")
        return {"error": "Acces WebRTC refuse - sender not in room"}
    
    if target_sid not in rooms_data.get(room_id, {}):
        print(f"   ❌ Target {target_sid} not in room")
        return {"error": "Acces WebRTC refuse - target not in room"}

    await sio.emit(
        "webrtc_answer",
        {
            "answer": answer,
            "fromId": sid,
            "roomId": room_id,
        },
        to=target_sid,
    )
    print(f"   ✅ Answer forwarded to {target_sid}")


@sio.event
async def ice_candidate(sid, data):
    target_sid = data.get("targetId")
    candidate = data.get("candidate")
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return {"error": "roomId requis"}
    room_id = str(room_id_int)

    print(f"🔍 ice_candidate: from={sid} to={target_sid} room={room_id}")

    if not _is_sid_in_room(sid, room_id):
        return {"error": "Acces WebRTC refuse - sender not in room"}

    if target_sid not in rooms_data.get(room_id, {}):
        return {"error": "Acces WebRTC refuse - target not in room"}

    await sio.emit(
        "ice_candidate",
        {
            "candidate": candidate,
            "fromId": sid,
            "roomId": room_id,
        },
        to=target_sid,
    )


@sio.event
async def chat_message(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    message = data.get("message")
    user_name = data.get("userName", "Anonyme")
    message_id = data.get("messageId")
    timestamp = data.get("timestamp") or datetime.now().isoformat()

    if room_id_int is None or not message:
        return {"error": "Message invalide"}
    room_id = str(room_id_int)

    if not _is_sid_in_room(sid, room_id):
        return {"error": "Acces refuse a cette salle"}

    payload = {
        "messageId": message_id or f"{int(datetime.now().timestamp() * 1000)}-{sid[:6]}",
        "message": message,
        "userName": user_name,
        "senderId": sid,
        "timestamp": timestamp,
    }

    if room_id not in chat_history:
        chat_history[room_id] = []

    chat_history[room_id].append(payload)
    if len(chat_history[room_id]) > MAX_HISTORY:
        chat_history[room_id] = chat_history[room_id][-MAX_HISTORY:]

    await sio.emit("chat_message", payload, room=room_id)
    return {"success": True, "messageId": payload["messageId"]}


@sio.event
async def media_state_change(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return {"error": "roomId requis"}
    room_id = str(room_id_int)

    if not _is_sid_in_room(sid, room_id):
        return {"error": "Acces refuse a cette salle"}

    await sio.emit(
        "media_state_change",
        {
            "userId": sid,
            "audio": data.get("audio"),
            "video": data.get("video"),
        },
        room=room_id,
        skip_sid=sid,
    )


@sio.event
async def typing_start(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return
    room_id = str(room_id_int)
    if not _is_sid_in_room(sid, room_id):
        return

    await sio.emit(
        "typing_start",
        {
            "userId": sid,
            "userName": data.get("userName", "Quelqu'un"),
        },
        room=room_id,
        skip_sid=sid,
    )


@sio.event
async def typing_stop(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return
    room_id = str(room_id_int)
    if not _is_sid_in_room(sid, room_id):
        return

    await sio.emit("typing_stop", {"userId": sid}, room=room_id, skip_sid=sid)


@sio.event
async def get_chat_history(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return {"error": "roomId requis"}
    room_id = str(room_id_int)
    if not _is_sid_in_room(sid, room_id):
        return {"error": "Acces refuse a cette salle"}

    return {"messages": chat_history.get(room_id, [])}


@sio.event
async def delete_message(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    message_id = data.get("messageId")
    if room_id_int is None or not message_id:
        return {"error": "roomId et messageId requis"}
    room_id = str(room_id_int)

    if not _is_sid_in_room(sid, room_id):
        return {"error": "Acces refuse a cette salle"}

    if room_id in chat_history:
        chat_history[room_id] = [
            msg for msg in chat_history[room_id] if msg.get("messageId") != message_id
        ]

    await sio.emit("message_deleted", {"messageId": message_id}, room=room_id)
    return {"success": True}


@sio.event
async def hand_raised(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return
    room_id = str(room_id_int)
    if not _is_sid_in_room(sid, room_id):
        return

    await sio.emit(
        "hand_raised",
        {
            "userId": sid,
            "userName": data.get("userName", "Participant"),
            "raised": bool(data.get("raised", False)),
        },
        room=room_id,
        skip_sid=sid,
    )


@sio.event
async def host_mute_all(sid, data):
    room_id_int = _resolve_room_id(data.get("roomId"))
    if room_id_int is None:
        return {"error": "roomId requis"}

    user_id = sid_user_ids.get(sid)
    if user_id is None:
        return {"error": "Unauthorized"}

    if not _is_host(user_id, room_id_int):
        return {"error": "Seul l'hote peut couper les medias"}

    room_id = str(room_id_int)
    if not _is_sid_in_room(sid, room_id):
        return {"error": "Hote non present dans la salle"}

    action = (data.get("action") or "audio").lower()
    force_audio = action in {"audio", "both"}
    force_video = action in {"video", "both"}

    await sio.emit(
        "host_force_media",
        {
            "roomId": room_id,
            "audio": False if force_audio else None,
            "video": False if force_video else None,
            "action": action,
        },
        room=room_id,
        skip_sid=sid,
    )

    return {"success": True}

