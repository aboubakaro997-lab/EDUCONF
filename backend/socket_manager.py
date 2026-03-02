from datetime import datetime

import socketio
from jose import JWTError, jwt

from app.config import settings


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins or ["*"],
    logger=True,
    engineio_logger=False,
)

rooms_data = {}
chat_history = {}
sid_user_ids = {}
MAX_HISTORY = 200


def get_room_participants(room_id: str):
    return rooms_data.get(room_id, {})


def get_room_messages(room_id: str):
    return chat_history.get(room_id, [])


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
            if not participants:
                del rooms_data[room_id]
            break


@sio.event
async def join_room(sid, data):
    room_id = data.get("roomId")
    user_name = data.get("userName", "Anonyme")
    user_id = sid_user_ids.get(sid)

    if user_id is None:
        return {"error": "Unauthorized"}

    if not room_id:
        return {"error": "room_id requis"}

    if room_id not in rooms_data:
        rooms_data[room_id] = {}

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

    rooms_data[room_id][sid] = {
        "sid": sid,
        "userId": user_id,
        "userName": user_name,
        "joinedAt": datetime.now().isoformat(),
    }

    await sio.enter_room(sid, room_id)

    await sio.emit(
        "user_joined",
        {
            "userId": sid,
            "userName": user_name,
            "participants": list(rooms_data[room_id].values()),
        },
        room=room_id,
        skip_sid=sid,
    )

    return {"success": True, "participants": list(rooms_data[room_id].values())}


@sio.event
async def leave_room(sid, data):
    room_id = data.get("roomId")

    if room_id and room_id in rooms_data:
        user_info = rooms_data[room_id].pop(sid, {})
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

        if not rooms_data[room_id]:
            del rooms_data[room_id]


@sio.event
async def webrtc_offer(sid, data):
    target_sid = data.get("targetId")
    offer = data.get("offer")
    room_id = data.get("roomId")

    await sio.emit(
        "webrtc_offer",
        {
            "offer": offer,
            "fromId": sid,
            "roomId": room_id,
        },
        to=target_sid,
    )


@sio.event
async def webrtc_answer(sid, data):
    target_sid = data.get("targetId")
    answer = data.get("answer")

    await sio.emit(
        "webrtc_answer",
        {
            "answer": answer,
            "fromId": sid,
        },
        to=target_sid,
    )


@sio.event
async def ice_candidate(sid, data):
    target_sid = data.get("targetId")
    candidate = data.get("candidate")

    await sio.emit(
        "ice_candidate",
        {
            "candidate": candidate,
            "fromId": sid,
        },
        to=target_sid,
    )


@sio.event
async def chat_message(sid, data):
    room_id = data.get("roomId")
    message = data.get("message")
    user_name = data.get("userName", "Anonyme")
    message_id = data.get("messageId")
    timestamp = data.get("timestamp") or datetime.now().isoformat()

    if not room_id or not message:
        return {"error": "Message invalide"}

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
    room_id = data.get("roomId")
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
    room_id = data.get("roomId")
    if not room_id:
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
    room_id = data.get("roomId")
    if not room_id:
        return

    await sio.emit("typing_stop", {"userId": sid}, room=room_id, skip_sid=sid)


@sio.event
async def get_chat_history(sid, data):
    room_id = data.get("roomId")
    if not room_id:
        return {"error": "roomId requis"}

    return {"messages": chat_history.get(room_id, [])}


@sio.event
async def delete_message(sid, data):
    room_id = data.get("roomId")
    message_id = data.get("messageId")
    if not room_id or not message_id:
        return {"error": "roomId et messageId requis"}

    if room_id in chat_history:
        chat_history[room_id] = [
            msg for msg in chat_history[room_id] if msg.get("messageId") != message_id
        ]

    await sio.emit("message_deleted", {"messageId": message_id}, room=room_id)
    return {"success": True}


@sio.event
async def hand_raised(sid, data):
    room_id = data.get("roomId")
    if not room_id:
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

