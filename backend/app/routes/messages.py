from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter()


@router.get("/rooms/{room_identifier}/messages", response_model=List[schemas.MessageResponse])
def get_room_messages(
    room_identifier: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Recupere l'historique des messages d'une salle par code ou ID."""

    room = None
    if room_identifier.isdigit():
        room = db.query(models.Room).filter(
            models.Room.id == int(room_identifier),
            models.Room.is_active == True,
        ).first()

    if room is None:
        room = db.query(models.Room).filter(
            models.Room.room_code == room_identifier,
            models.Room.is_active == True,
        ).first()

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    participant = db.query(models.Participant).filter(
        models.Participant.room_id == room.id,
        models.Participant.user_id == current_user.id,
    ).first()

    if not participant:
        raise HTTPException(status_code=403, detail="You are not a participant of this room")

    messages = (
        db.query(models.Message)
        .filter(models.Message.room_id == room.id)
        .order_by(models.Message.created_at.desc())
        .limit(limit)
        .all()
    )

    return messages[::-1]
