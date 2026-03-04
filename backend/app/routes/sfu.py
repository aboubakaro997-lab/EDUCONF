from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from livekit import api as livekit_api

from .. import auth, models
from ..config import settings
from ..database import get_db


router = APIRouter(prefix="/api/sfu", tags=["SFU"])


class SfuTokenRequest(BaseModel):
    room_id: int


class SfuTokenResponse(BaseModel):
    token: str
    livekit_url: str
    room_name: str


@router.post("/token", response_model=SfuTokenResponse)
def create_sfu_token(
    payload: SfuTokenRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        raise HTTPException(status_code=503, detail="SFU is not configured")

    room = db.query(models.Room).filter(
        models.Room.id == payload.room_id,
        models.Room.is_active == True,
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    participant = db.query(models.Participant).filter(
        models.Participant.room_id == room.id,
        models.Participant.user_id == current_user.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=403, detail="Acces refuse a cette salle")

    identity = str(current_user.id)
    display_name = current_user.full_name or current_user.username
    room_name = str(room.id)

    grants = livekit_api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    )
    token = (
        livekit_api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(display_name)
        .with_grants(grants)
        .to_jwt()
    )

    return SfuTokenResponse(
        token=token,
        livekit_url=settings.LIVEKIT_URL,
        room_name=room_name,
    )
