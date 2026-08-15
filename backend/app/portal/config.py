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

    # Mail — Amazon SES. Credentials come from the App Runner instance role, so
    # there is no username/password to rotate. MAIL_FROM must be a verified SES
    # identity or every send is rejected.
    MAIL_FROM: str = "info@udyaan.org"
    MAIL_FROM_NAME: str = "Udyaan Pvt Ltd"
    MAIL_REPLY_TO: str = ""
    # Defaults to AWS_REGION; set only when SES lives in a different region to
    # the rest of the stack (SES is not available in every region).
    SES_REGION: str = ""
    # Optional: enables bounce/complaint/open tracking on the SES side.
    SES_CONFIGURATION_SET: str = ""

    # Encrypts message bodies and inbox previews at rest. Comma-separated
    # Fernet keys, newest first; every key is tried on read, only the first is
    # used to write, which is what makes rotation possible. Empty stores
    # plaintext so a laptop with no secrets still runs.
    MESSAGE_ENCRYPTION_KEYS: str = ""

    # Redis (Upstash) — OTP + short-lived state
    REDIS_URL: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # Amazon S3 — community post attachments (research PDFs etc). Empty bucket
    # disables uploads and the API degrades to link-only, keeping the stack
    # runnable on a laptop with no cloud credentials.
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET: str = ""
    S3_UPLOAD_PREFIX: str = "community"
    S3_SIGNED_URL_TTL_SECONDS: int = 600
    MAX_UPLOAD_BYTES: int = 25 * 1024 * 1024

    # Lets Cloud Scheduler run the embedding backfill unattended, since an admin
    # JWT expires and cannot be baked into a recurring job. Empty disables that
    # auth path outright, so an unset secret can never leave the endpoint open.
    BACKFILL_TOKEN: str = ""

    # Bootstrap owner. Both must be set for the account to be created on startup;
    # there is deliberately no default password, so an unconfigured deployment
    # never ships a known super-user credential. Set these in .env, never here —
    # this file is tracked by git.
    OWNER_EMAIL: str = ""
    OWNER_PASSWORD: str = ""
    OWNER_NAME: str = "Platform Owner"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
