from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user_ws
from ..websocket_manager import manager
from datetime import datetime
import json

router = APIRouter()

@router.websocket("/ws/{room_code}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    token: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint pour la communication en temps réel
    Usage: ws://localhost:8000/api/ws/{room_code}?token={jwt_token}
    """
    try:
        # Vérifier le token
        user = await get_current_user_ws(token, db)
        
        # Vérifier que la salle existe
        room = db.query(models.Room).filter(
            models.Room.room_code == room_code,
            models.Room.is_active == True
        ).first()
        
        if not room:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Vérifier que l'utilisateur est participant
        participant = db.query(models.Participant).filter(
            models.Participant.room_id == room.id,
            models.Participant.user_id == user.id
        ).first()
        
        if not participant:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Créer une session
        session = models.RoomSession(
            room_id=room.id,
            user_id=user.id,
            socket_id=str(id(websocket))
        )
        db.add(session)
        db.commit()
        
        # Connecter l'utilisateur
        await manager.connect(websocket, room_code, user.id)
        
        # Envoyer la liste des participants actuels
        participants_list = manager.get_room_participants(room_code)
        await manager.send_personal_message(
            {
                "type": "participants_list",
                "participants": participants_list
            },
            room_code,
            user.id
        )
        
        try:
            while True:
                # Recevoir les messages
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                message_type = message_data.get("type")
                
                if message_type == "chat_message":
                    # Sauvegarder le message
                    new_message = models.Message(
                        room_id=room.id,
                        user_id=user.id,
                        content=message_data.get("content"),
                        message_type="text"
                    )
                    db.add(new_message)
                    db.commit()
                    db.refresh(new_message)
                    
                    # Diffuser à tous
                    await manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "chat_message",
                            "message_id": new_message.id,
                            "user_id": user.id,
                            "username": user.username,
                            "content": message_data.get("content"),
                            "timestamp": str(new_message.created_at)
                        }
                    )
                
                elif message_type == "webrtc_offer":
                    # Transférer l'offre WebRTC
                    target_user = message_data.get("target_user_id")
                    await manager.send_personal_message(
                        {
                            "type": "webrtc_offer",
                            "from_user_id": user.id,
                            "sdp": message_data.get("sdp")
                        },
                        room_code,
                        target_user
                    )
                
                elif message_type == "webrtc_answer":
                    # Transférer la réponse WebRTC
                    target_user = message_data.get("target_user_id")
                    await manager.send_personal_message(
                        {
                            "type": "webrtc_answer",
                            "from_user_id": user.id,
                            "sdp": message_data.get("sdp")
                        },
                        room_code,
                        target_user
                    )
                
                elif message_type == "webrtc_ice_candidate":
                    # Transférer les ICE candidates
                    target_user = message_data.get("target_user_id")
                    await manager.send_personal_message(
                        {
                            "type": "webrtc_ice_candidate",
                            "from_user_id": user.id,
                            "candidate": message_data.get("candidate")
                        },
                        room_code,
                        target_user
                    )
                
                elif message_type == "toggle_screen_share":
                    # Mettre à jour le statut de partage d'écran
                    is_sharing = message_data.get("is_sharing", False)
                    session.is_sharing_screen = is_sharing
                    db.commit()
                    
                    # Notifier les autres
                    await manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "screen_share_status",
                            "user_id": user.id,
                            "is_sharing": is_sharing
                        },
                        exclude_user=user.id
                    )
                
                elif message_type == "toggle_media":
                    # Mettre à jour le statut audio/vidéo
                    media_type = message_data.get("media_type")  # "audio" ou "video"
                    is_enabled = message_data.get("is_enabled", False)
                    
                    if media_type == "audio":
                        session.is_audio_enabled = is_enabled
                    elif media_type == "video":
                        session.is_video_enabled = is_enabled
                    
                    db.commit()
                    
                    # Notifier les autres
                    await manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "media_status",
                            "user_id": user.id,
                            "media_type": media_type,
                            "is_enabled": is_enabled
                        },
                        exclude_user=user.id
                    )
        
        except WebSocketDisconnect:
            # Déconnecter l'utilisateur
            manager.disconnect(room_code, user.id)
            
            # Mettre à jour la session
            session.left_at = datetime.utcnow()
            db.commit()
            
            # Notifier les autres
            await manager.broadcast_to_room(
                room_code,
                {
                    "type": "user_left",
                    "user_id": user.id,
                    "timestamp": str(datetime.utcnow())
                }
            )
    
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
