import bcrypt
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .config import settings
from . import models
from .database import get_db

# Schéma OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


# ============ FONCTIONS DE HACHAGE ============

def hash_password(password: str) -> str:
    """Hache un mot de passe avec bcrypt standard."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son hash bcrypt.

    Compatibilité ascendante:
    - 1er essai: bcrypt standard
    - fallback: ancien format (sha256+base64 puis bcrypt)
    """
    try:
        if bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8")):
            return True
    except Exception:
        return False

    # Fallback legacy (anciens comptes)
    try:
        import hashlib
        import base64

        digest = hashlib.sha256(plain_password.encode("utf-8")).digest()
        legacy_prepared = base64.b64encode(digest)
        return bcrypt.checkpw(legacy_prepared, hashed_password.encode("utf-8"))
    except Exception:
        return False


# ============ GESTION DES TOKENS JWT ============

def create_access_token(data: dict) -> str:
    """Crée un token JWT"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def create_refresh_token(data: dict) -> str:
    """Crée un refresh token JWT."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(
        to_encode,
        settings.REFRESH_SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def create_token_pair(data: dict) -> dict:
    """Retourne access + refresh token."""
    return {
        "access_token": create_access_token(data),
        "refresh_token": create_refresh_token(data),
        "token_type": "bearer",
    }


def verify_token(token: str):
    """Décode et vérifie un token JWT"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type and token_type != "access":
            return None
        return payload
    except JWTError:
        return None


def verify_refresh_token(token: str):
    """Décode et vérifie un refresh token JWT."""
    try:
        payload = jwt.decode(
            token,
            settings.REFRESH_SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


# ============ AUTHENTIFICATION ROUTES HTTP ============

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Obtient l'utilisateur actuel depuis le token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(models.User).filter(
        models.User.id == int(user_id)
    ).first()

    if user is None:
        raise credentials_exception

    return user


# ============ AUTHENTIFICATION WEBSOCKETS ============

async def get_current_user_ws(token: str, db: Session):
    """Vérifie le token JWT pour les WebSockets"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(
        models.User.id == int(user_id)
    ).first()

    if user is None:
        raise credentials_exception

    return user
