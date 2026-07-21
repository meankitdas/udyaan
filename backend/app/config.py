"""Application settings, loaded from environment variables.

Cloud integrations activate automatically when their env vars are present:
- GCP Firestore:  GCP_PROJECT (+ GOOGLE_APPLICATION_CREDENTIALS or ADC)
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

        # Google Cloud
        self.gcp_project = os.getenv("GCP_PROJECT", "")
        self.firestore_database = os.getenv("FIRESTORE_DATABASE", "(default)")
        self.gcs_bucket = os.getenv("GCS_BUCKET", "")

        # Azure OpenAI
        self.azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        self.azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
        self.azure_openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
        self.azure_chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")
        self.azure_embedding_deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")

        # Local fallback storage
        self.data_dir = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))

    @property
    def use_firestore(self) -> bool:
        return bool(self.gcp_project)

    @property
    def use_azure_openai(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
