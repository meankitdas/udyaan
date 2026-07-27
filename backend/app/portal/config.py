from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # Database (portal). Empty by default so the merged app boots without portal env.
    DATABASE_URL: str = ""

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://udyaan.org",
    ]

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024

    # Mail Settings
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "info@udyaan.org"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.zeptomail.in"

    # Redis (Upstash) — OTP + short-lived state
    REDIS_URL: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # Google Cloud Storage — community post attachments (research PDFs etc).
    # Empty bucket disables uploads and the API degrades to link-only, keeping
    # the stack runnable on a laptop with no cloud credentials.
    GCS_BUCKET: str = ""
    GCS_UPLOAD_PREFIX: str = "community"
    GCS_SIGNED_URL_TTL_SECONDS: int = 600
    MAX_UPLOAD_BYTES: int = 25 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
