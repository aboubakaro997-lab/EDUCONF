import logging
import time
from collections import defaultdict

import socketio
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware

from socket_manager import sio

from . import auth, models, schemas
from .config import settings
from .database import engine, get_db
from .routes import messages, rooms, websocket


logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("educonf")


class InMemoryRateLimiter:
    def __init__(self):
        self._hits = defaultdict(list)

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        bucket = [ts for ts in self._hits[key] if ts >= window_start]
        self._hits[key] = bucket
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        self._hits[key] = bucket
        return True


limiter = InMemoryRateLimiter()

settings.validate_for_runtime()
models.Base.metadata.create_all(bind=engine)

fastapi_app = FastAPI(
    title=settings.APP_NAME,
    description="API for the educational video conference platform",
    version=settings.APP_VERSION,
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.allowed_hosts and settings.allowed_hosts != ["*"]:
    fastapi_app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@fastapi_app.on_event("startup")
def startup_check() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connectivity check OK")
    except Exception as exc:
        logger.exception("Database connectivity check failed")
        raise RuntimeError("Database is unreachable") from exc


@fastapi_app.post("/api/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    key = f"register:{ip}"
    if not limiter.check(
        key,
        settings.RATE_LIMIT_REGISTER_ATTEMPTS,
        settings.RATE_LIMIT_REGISTER_WINDOW_SECONDS,
    ):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Try again later.")

    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur deja enregistre")

    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email deja enregistre")

    hashed_password = auth.hash_password(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@fastapi_app.post("/api/login", response_model=schemas.Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    key = f"login:{ip}"
    if not limiter.check(
        key,
        settings.RATE_LIMIT_LOGIN_ATTEMPTS,
        settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
    ):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    user = db.query(models.User).filter(models.User.username == form_data.username).first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@fastapi_app.get("/api/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


fastapi_app.include_router(rooms.router, prefix="/api", tags=["Rooms"])
fastapi_app.include_router(websocket.router, prefix="/api", tags=["WebSocket"])
fastapi_app.include_router(messages.router, prefix="/api", tags=["Messages"])


@fastapi_app.get("/")
def root():
    return {
        "message": f"Bienvenue sur {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "status": "operationnel",
        "environment": settings.ENVIRONMENT,
    }


@fastapi_app.get("/health")
def health():
    return {"status": "ok"}


@fastapi_app.get("/ready")
def ready():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not ready")


app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
