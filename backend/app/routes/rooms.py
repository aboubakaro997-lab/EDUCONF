from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import string
import random
from datetime import datetime
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/rooms", tags=["Rooms"])


def generate_room_code():
    """Genere un code de salle aleatoire de 6 caracteres."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def format_seconds(total_seconds: int) -> str:
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


@router.get("/", response_model=List[schemas.RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Liste uniquement les salles auxquelles l'utilisateur participe."""
    return (
        db.query(models.Room)
        .join(models.Participant, models.Participant.room_id == models.Room.id)
        .filter(models.Room.is_active == True)
        .filter(models.Participant.user_id == current_user.id)
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


@router.get("/my", response_model=List[schemas.RoomResponse])
def list_my_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Compat frontend: retourne les salles de l'utilisateur."""
    return (
        db.query(models.Room)
        .join(models.Participant, models.Participant.room_id == models.Room.id)
        .filter(models.Room.is_active == True)
        .filter(models.Participant.user_id == current_user.id)
        .order_by(models.Room.created_at.desc())
        .all()
    )


@router.get("/{room_id}", response_model=schemas.RoomResponse)
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Recuperer une salle par son ID si l'utilisateur y participe."""
    room = db.query(models.Room).filter(
        models.Room.id == room_id,
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

    return room


@router.post("/join/{room_code}", response_model=schemas.RoomResponse)
def join_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Rejoindre une salle avec un code."""
    normalized_code = room_code.strip().upper()
    room = db.query(models.Room).filter(
        models.Room.room_code == normalized_code,
        models.Room.is_active == True,
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    existing = db.query(models.Participant).filter(
        models.Participant.room_id == room.id,
        models.Participant.user_id == current_user.id,
    ).first()

    if existing:
        return room

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
    """Rejoindre une salle par ID uniquement si l'utilisateur est deja participant."""
    room = db.query(models.Room).filter(
        models.Room.id == room_id,
        models.Room.is_active == True,
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    existing = db.query(models.Participant).filter(
        models.Participant.room_id == room.id,
        models.Participant.user_id == current_user.id,
    ).first()

    if not existing:
        raise HTTPException(
            status_code=403,
            detail="Acces refuse. Rejoignez la salle via un lien/code d'invitation",
        )

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


@router.get("/{room_id}/attendance", response_model=schemas.AttendanceReportResponse)
def get_room_attendance(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Generer la liste de presence (reserve a l'hote)."""
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    if room.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul l'hote peut generer la liste de presence")

    sessions = (
        db.query(models.RoomSession, models.User)
        .join(models.User, models.User.id == models.RoomSession.user_id)
        .filter(models.RoomSession.room_id == room_id)
        .order_by(models.RoomSession.joined_at.asc())
        .all()
    )

    now = datetime.utcnow()
    by_user = {}

    for session, user in sessions:
        if user.id not in by_user:
            by_user[user.id] = {
                "user_id": user.id,
                "nom_prenom": user.full_name or user.username,
                "heure_entree": session.joined_at,
                "heure_sortie": session.left_at,
                "temps_total_secondes": 0,
            }

        entry = by_user[user.id]

        if session.joined_at and (
            entry["heure_entree"] is None or session.joined_at < entry["heure_entree"]
        ):
            entry["heure_entree"] = session.joined_at

        candidate_exit = session.left_at or now
        if entry["heure_sortie"] is None or candidate_exit > entry["heure_sortie"]:
            entry["heure_sortie"] = candidate_exit

        if session.joined_at:
            end_time = session.left_at or now
            delta = int((end_time - session.joined_at).total_seconds())
            entry["temps_total_secondes"] += max(0, delta)

    participants = []
    for item in by_user.values():
        participants.append(
            schemas.AttendanceEntryResponse(
                user_id=item["user_id"],
                nom_prenom=item["nom_prenom"],
                heure_entree=item["heure_entree"],
                heure_sortie=item["heure_sortie"],
                temps_total_secondes=item["temps_total_secondes"],
                temps_total_humain=format_seconds(item["temps_total_secondes"]),
            )
        )

    participants.sort(key=lambda x: x.nom_prenom.lower())

    return schemas.AttendanceReportResponse(
        room_id=room.id,
        room_name=room.name,
        generated_at=now,
        participants=participants,
    )


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
