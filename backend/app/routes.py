from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import models, schemas, auth
from .database import get_db
from . import auth


router = APIRouter()

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Inscription d'un nouvel utilisateur
    """
    # Vérifier si l'email existe déjà
    existing_email = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé"
        )
    
    # Vérifier si le username existe déjà
    existing_username = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce nom d'utilisateur est déjà pris"
        )
    
    # Créer le nouvel utilisateur
    hashed_password = auth.hash_password(user.password)
    new_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        full_name=user.full_name
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

# Route de connexion
@router.post("/api/login", response_model=schemas.Token)
def login(user_login: schemas.UserLogin, db: Session = Depends(get_db)):
    # Chercher l'utilisateur par email ou username
    user = db.query(models.User).filter(
        (models.User.email == user_login.username) | 
        (models.User.username == user_login.username)
    ).first()
    
    # Vérifier si l'utilisateur existe
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Email/Username ou mot de passe incorrect"
        )
    
    # Vérifier le mot de passe
    if not auth.verify_password(user_login.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Email/Username ou mot de passe incorrect"
        )
    
    # Vérifier si le compte est actif
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Compte désactivé"
        )
    
    # Créer le token JWT
    access_token = auth.create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Route protégée - Obtenir le profil de l'utilisateur connecté
@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(auth.get_current_user)):
    """
    Route protégée qui retourne les informations de l'utilisateur connecté
    Nécessite un token JWT valide
    """
    return current_user
