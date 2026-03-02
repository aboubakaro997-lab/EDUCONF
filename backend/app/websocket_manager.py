from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        # Structure: {room_code: {user_id: websocket}}
        self.active_connections: Dict[str, Dict[int, WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room_code: str, user_id: int):
        await websocket.accept()
        
        if room_code not in self.active_connections:
            self.active_connections[room_code] = {}
        
        self.active_connections[room_code][user_id] = websocket
        
        # Notifier les autres participants
        await self.broadcast_to_room(
            room_code,
            {
                "type": "user_joined",
                "user_id": user_id,
                "timestamp": str(datetime.utcnow())
            },
            exclude_user=user_id
        )
    
    def disconnect(self, room_code: str, user_id: int):
        if room_code in self.active_connections:
            if user_id in self.active_connections[room_code]:
                del self.active_connections[room_code][user_id]
            
            # Nettoyer la salle si vide
            if not self.active_connections[room_code]:
                del self.active_connections[room_code]
    
    async def send_personal_message(self, message: dict, room_code: str, user_id: int):
        if room_code in self.active_connections:
            if user_id in self.active_connections[room_code]:
                await self.active_connections[room_code][user_id].send_json(message)
    
    async def broadcast_to_room(self, room_code: str, message: dict, exclude_user: int = None):
        if room_code in self.active_connections:
            for user_id, connection in self.active_connections[room_code].items():
                if exclude_user is None or user_id != exclude_user:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        print(f"Error sending to user {user_id}: {e}")
    
    def get_room_participants(self, room_code: str) -> List[int]:
        if room_code in self.active_connections:
            return list(self.active_connections[room_code].keys())
        return []

from datetime import datetime

# Instance globale
manager = ConnectionManager()
