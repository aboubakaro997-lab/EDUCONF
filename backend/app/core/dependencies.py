from __future__ import annotations

import logging
from functools import wraps
from typing import List, Optional, TYPE_CHECKING

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

if TYPE_CHECKING:
    pass

# ── Logger ────────────────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ── OAuth2 Scheme ─────────────────────────────────────────────────────────────
oauth2_scheme          = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False   # Ne lève pas d'erreur si token absent
)


# ==============================================================================
#  EXCEPTIONS PERSONNALISÉES
# ==============================================================================

def _unauthorized(detail: str = "Token invalide ou expiré") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str = "Accès refusé") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


# ==============================================================================
#  DÉPENDANCES PRINCIPALES
# ==============================================================================

def get_current_user(
    token: str  = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
) -> User:
    """
    Retourne l'utilisateur authentifié à partir du JWT.
    Lève une HTTP 401 si le token est absent, invalide ou expiré.
    """
    if not token:
        raise _unauthorized("Token d'authentification manquant")

    payload = decode_access_token(token)
    if not payload:
        raise _unauthorized("Token invalide ou expiré")

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise _unauthorized("Token malformé — champ 'sub' manquant")

    # Récupération en DB
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        raise _unauthorized("Identifiant utilisateur invalide dans le token")

    if not user:
        logger.warning("Tentative d'accès avec un token valide mais user_id=%s inexistant", user_id)
        raise _unauthorized("Utilisateur introuvable")

    if not user.is_active:
        raise _forbidden("Compte désactivé. Contactez l'administrateur.")

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Alias de `get_current_user` avec double vérification is_active.
    Utilisé comme dépendance standard dans les routes protégées.
    """
    if not current_user.is_active:
        raise _forbidden("Compte désactivé")
    return current_user


def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db:    Session       = Depends(get_db),
) -> Optional[User]:
    """
    Retourne l'utilisateur si authentifié, sinon None.
    Utile pour les routes publiques avec comportement enrichi si connecté.
    """
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        return user if user and user.is_active else None
    except (ValueError, TypeError):
        return None


# ==============================================================================
#  CONTRÔLE DES RÔLES
# ==============================================================================

def require_role(*roles: UserRole):
    """
    Factory de dépendance — vérifie que l'utilisateur possède l'un des rôles.

    Usage :
        @router.get("/admin-only")
        def admin_route(user = Depends(require_role(UserRole.admin))):
            ...

        @router.get("/staff")
        def staff_route(user = Depends(require_role(UserRole.admin, UserRole.teacher))):
            ...
    """
    def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in roles:
            role_labels = ", ".join(r.value for r in roles)
            logger.warning(
                "Accès refusé — user_id=%s role=%s requis=%s",
                current_user.id,
                current_user.role,
                role_labels,
            )
            raise _forbidden(
                f"Action réservée aux rôles : {role_labels}"
            )
        return current_user

    return role_checker


# ── Raccourcis pratiques ──────────────────────────────────────────────────────

def require_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Accès réservé aux administrateurs."""
    if current_user.role != UserRole.admin:
        raise _forbidden("Action réservée aux administrateurs")
    return current_user


def require_teacher_or_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Accès réservé aux enseignants et administrateurs."""
    if current_user.role not in (UserRole.teacher, UserRole.admin):
        raise _forbidden("Action réservée aux enseignants et administrateurs")
    return current_user


# ==============================================================================
#  DÉPENDANCE PAGINATION
# ==============================================================================

class PaginationParams:
    """
    Paramètres de pagination réutilisables.

    Usage :
        @router.get("/items")
        def list_items(pagination: PaginationParams = Depends()):
            items = db.query(...).offset(pagination.skip).limit(pagination.limit).all()
    """
    def __init__(
        self,
        skip:  int = 0,
        limit: int = 20,
    ):
        if skip < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Le paramètre 'skip' doit être >= 0"
            )
        if not (1 <= limit <= 100):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Le paramètre 'limit' doit être entre 1 et 100"
            )
        self.skip  = skip
        self.limit = limit


# ==============================================================================
#  VÉRIFICATION PROPRIÉTAIRE RESSOURCE
# ==============================================================================

def verify_resource_owner(
    resource_user_id: int,
    current_user:     User,
    allow_admin:      bool = True,
) -> None:
    """
    Vérifie que current_user est propriétaire de la ressource.
    Les admins peuvent bypasser si allow_admin=True.

    Usage :
        verify_resource_owner(room.creator_id, current_user)
    """
    is_owner = resource_user_id == current_user.id
    is_admin = allow_admin and current_user.role == UserRole.admin

    if not (is_owner or is_admin):
        raise _forbidden(
            "Vous n'êtes pas autorisé à modifier cette ressource"
        )


# ==============================================================================
#  LOGGING REQUÊTES (middleware-like dépendance)
# ==============================================================================

async def log_request(request: Request) -> None:
    """
    Loggue les informations de la requête entrante.

    Usage (optionnel sur certaines routes) :
        @router.get("/sensitive", dependencies=[Depends(log_request)])
    """
    logger.info(
        "📥 %s %s | IP: %s | UA: %s",
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown")[:80],
    )
