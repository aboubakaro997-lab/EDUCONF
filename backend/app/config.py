from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "EduConf CI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"  # development | production
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "sqlite:///./educonf.db"

    SECRET_KEY: str = "change-me-access-secret"
    REFRESH_SECRET_KEY: str = "change-me-refresh-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CSV in .env, e.g. "http://localhost:3000,https://app.example.com"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"

    RATE_LIMIT_LOGIN_ATTEMPTS: int = 10
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 300
    RATE_LIMIT_REGISTER_ATTEMPTS: int = 5
    RATE_LIMIT_REGISTER_WINDOW_SECONDS: int = 600
    REDIS_URL: Optional[str] = None
    RATE_LIMIT_REDIS_PREFIX: str = "educonf:ratelimit"

    MAIL_SERVER: Optional[str] = None
    MAIL_PORT: Optional[int] = None
    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def allowed_origins(self) -> List[str]:
        raw = (self.ALLOWED_ORIGINS or "").strip()
        if not raw:
            return []
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def allowed_hosts(self) -> List[str]:
        raw = (self.ALLOWED_HOSTS or "").strip()
        if not raw:
            return ["*"]
        return [host.strip() for host in raw.split(",") if host.strip()]

    def validate_for_runtime(self) -> None:
        if not self.is_production:
            return

        if len(self.SECRET_KEY) < 32 or len(self.REFRESH_SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY and REFRESH_SECRET_KEY must be at least 32 chars in production")

        forbidden = {
            "change-me-access-secret",
            "change-me-refresh-secret",
            "educonf-access-secret-key-changez-moi-en-prod",
            "educonf-refresh-secret-key-changez-moi-en-prod",
        }
        if self.SECRET_KEY in forbidden or self.REFRESH_SECRET_KEY in forbidden:
            raise ValueError("Default JWT secrets are not allowed in production")

        if not self.allowed_origins:
            raise ValueError("ALLOWED_ORIGINS must be set in production")


settings = Settings()
