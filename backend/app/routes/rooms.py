from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import string
import random
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/rooms", tags=["Rooms"])


def generate_room_code():
    """Genere un code de salle aleatoire de 6 caracteres."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.get("/", response_model=List[schemas.RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Liste les salles actives."""
    return (
        db.query(models.Room)
        .filter(models.Room.is_active == True)
        .order_by(models.Room.created_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.RoomResponse)
def create_room(
    room: schemas.RoomCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Creer une nouvelle salle de conference."""
    room_code = generate_room_code()

    while db.query(models.Room).filter(models.Room.room_code == room_code).first():
        room_code = generate_room_code()

    db_room = models.Room(
        name=room.name,
        description=room.description,
        room_code=room_code,
        host_id=current_user.id,
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)

    participant = models.Participant(
        room_id=db_room.id,
        user_id=current_user.id,
        is_host=True,
    )
    db.add(participant)
    db.commit()

    return db_room


@router.get("/{room_id}", response_model=schemas.RoomResponse)
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Recuperer une salle par son ID."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")
    return room


@router.post("/join/{room_code}", response_model=schemas.RoomResponse)
def join_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Rejoindre une salle avec un code."""
    room = db.query(models.Room).filter(models.Room.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    existing = db.query(models.Participant).filter(
        models.Participant.room_id == room.id,
        models.Participant.user_id == current_user.id,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Vous etes deja dans cette salle")

    participant = models.Participant(
        room_id=room.id,
        user_id=current_user.id,
        is_host=False,
    )
    db.add(participant)
    db.commit()

    return room


@router.post("/{room_id}/join", response_model=schemas.RoomResponse)
def join_room_by_id(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Compat frontend: rejoindre une salle par ID."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    existing = db.query(models.Participant).filter(
        models.Participant.room_id == room.id,
        models.Participant.user_id == current_user.id,
    ).first()

    if not existing:
        participant = models.Participant(
            room_id=room.id,
            user_id=current_user.id,
            is_host=(room.host_id == current_user.id),
        )
        db.add(participant)
        db.commit()

    return room


@router.delete("/leave/{room_id}")
def leave_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Quitter une salle."""
    participant = db.query(models.Participant).filter(
        models.Participant.room_id == room_id,
        models.Participant.user_id == current_user.id,
    ).first()

    if not participant:
        raise HTTPException(status_code=404, detail="Vous n'etes pas dans cette salle")

    if participant.is_host:
        raise HTTPException(status_code=400, detail="L'hote ne peut pas quitter sa propre salle")

    db.delete(participant)
    db.commit()
    return {"message": "Vous avez quitte la salle"}


@router.post("/{room_id}/leave")
def leave_room_post(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Compat frontend: quitter via POST /rooms/{id}/leave."""
    participant = db.query(models.Participant).filter(
        models.Participant.room_id == room_id,
        models.Participant.user_id == current_user.id,
    ).first()

    if not participant:
        return {"message": "Vous n'etes pas dans cette salle"}

    if participant.is_host:
        raise HTTPException(status_code=400, detail="L'hote ne peut pas quitter sa propre salle")

    db.delete(participant)
    db.commit()
    return {"message": "Vous avez quitte la salle"}


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Supprimer une salle (seulement l'hote)."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()

    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    if room.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul l'hote peut supprimer la salle")

    db.delete(room)
    db.commit()

    return {"message": "Salle supprimee avec succes"}
