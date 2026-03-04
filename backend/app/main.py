import logging

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from socket_manager import sio

from . import models
from .config import settings
from .database import engine
from .routes import auth as auth_routes
from .routes import messages, rooms
from .routes import sfu


logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("educonf")


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


@fastapi_app.on_event("startup")
def startup_check() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connectivity check OK")
    except Exception as exc:
        logger.exception("Database connectivity check failed")
        raise RuntimeError("Database is unreachable") from exc


fastapi_app.include_router(auth_routes.router)
fastapi_app.include_router(sfu.router)
fastapi_app.include_router(rooms.router, prefix="/api", tags=["Rooms"])
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
