from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# ============ USER SCHEMAS ============
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ ROOM SCHEMAS ============
class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = None

class RoomResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    room_code: str
    host_id: int  # ← CORRIGÉ (était owner_id)
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ PARTICIPANT SCHEMAS ============
class ParticipantResponse(BaseModel):
    id: int
    room_id: int
    user_id: int
    is_host: bool
    joined_at: datetime
    
    class Config:
        from_attributes = True

# ============ TOKEN SCHEMAS ============
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# ============ MESSAGE SCHEMAS ============
class MessageCreate(BaseModel):
    content: str
    message_type: Optional[str] = "text"

class MessageResponse(BaseModel):
    id: int
    room_id: int
    user_id: int
    content: str
    message_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============ SESSION SCHEMAS ============
class SessionResponse(BaseModel):
    id: int
    room_id: int
    user_id: int
    socket_id: str
    is_sharing_screen: bool
    is_audio_enabled: bool
    is_video_enabled: bool
    joined_at: datetime
    
    class Config:
        from_attributes = True
