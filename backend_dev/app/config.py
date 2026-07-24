from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    DATABASE_URL: str
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://udyaan.org"
    ]
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024
    
    # Mail Settings
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str = "info@udyaan.org"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.zeptomail.in"
    
    # Redis (Upstash)
    REDIS_URL: str
    FRONTEND_URL: str

    class Config:
        env_file = ".env"

settings = Settings()
