"""Application settings, loaded from environment variables.

Cloud integrations activate automatically when their env vars are present:
- Postgres:       DATABASE_URL (survey forms and responses; the portal uses the
                  same database through its own async engine)
- Azure OpenAI:   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
                  AZURE_OPENAI_CHAT_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT
Without them the API falls back to local JSON storage and heuristic screening,
so the whole stack stays runnable on a laptop.
"""

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        # Server
        self.port = int(os.getenv("PORT", "8080"))
        self.cors_origins = [
            o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        ]

        # Admin auth
        self.admin_email = os.getenv("ADMIN_EMAIL", "admin@udyaan.edu")
        self.admin_password = os.getenv("ADMIN_PASSWORD", "udyaan-admin")
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-production")
        self.jwt_ttl_hours = int(os.getenv("JWT_TTL_HOURS", "12"))

        # AWS. Region matters: the database and asset bucket both live in
        # ap-south-1, and placing compute elsewhere puts a cross-region hop on
        # every query.
        self.aws_region = os.getenv("AWS_REGION", "ap-south-1")

        # Survey storage. Shares the portal's Postgres instance rather than
        # running a second datastore for six documents.
        self.database_url = os.getenv("DATABASE_URL", "")

        # Azure OpenAI
        self.azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        self.azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
        self.azure_openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
        self.azure_chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")
        self.azure_embedding_deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")

        # Local fallback storage
        self.data_dir = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))

    @property
    def use_postgres(self) -> bool:
        return bool(self.database_url)

    @property
    def use_azure_openai(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
