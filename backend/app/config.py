"""Application settings, loaded from environment variables.

Cloud integrations activate automatically when their env vars are present:
- Postgres:       DATABASE_URL (survey forms and responses; the portal uses the
                  same database through its own async engine)
- Azure OpenAI:   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
                  AZURE_OPENAI_CHAT_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT
- CV uploads:     SURVEY_CV_BUCKET (+ AWS_REGION); without it the survey still
                  accepts a submission but records only the filename, and the
                  admin console says so instead of offering a download. This is
                  deliberately *not* S3_BUCKET -- see `cv_bucket` below.
Without them the API falls back to local JSON storage and heuristic screening,
so the whole stack stays runnable on a laptop.
"""

import logging
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

        # Candidate CV uploads.
        #
        # A different bucket from the portal's `S3_BUCKET`, not just a different
        # prefix, and deliberately with **no fallback** to it. Community
        # attachments are handed out as plain public URLs, so a working portal
        # implies that bucket is public-read; a CV is personal data served only
        # through short-lived signed URLs. Falling back would therefore publish
        # every CV, silently and with no error -- the failure mode is invisible
        # and unrecoverable (the files are already out). Unset means CV uploads
        # stay off, which is the safe direction: submissions still succeed and
        # the admin console says the file was not stored.
        self.cv_bucket = os.getenv("SURVEY_CV_BUCKET", "").strip()
        # Kept only to detect the misconfiguration below; the survey never
        # uploads here.
        self._portal_bucket = os.getenv("S3_BUCKET", "").strip()
        self.cv_upload_prefix = os.getenv("SURVEY_CV_PREFIX", "survey-cv").strip("/")
        self.max_cv_bytes = int(os.getenv("MAX_CV_BYTES", str(10 * 1024 * 1024)))
        self.signed_url_ttl_seconds = int(os.getenv("S3_SIGNED_URL_TTL_SECONDS", "900"))

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

    @property
    def cv_bucket_conflict(self) -> bool:
        """True when the CV bucket is the portal's public attachment bucket.

        Always a misconfiguration in this codebase rather than a judgement call:
        the portal serves attachments as plain public URLs, so a bucket that
        works for the portal is necessarily public-read, and pointing CVs at it
        publishes personal data. There is no deployment where these should be
        equal, so this disables uploads rather than warning and proceeding.
        """
        return bool(self.cv_bucket) and self.cv_bucket == self._portal_bucket

    @property
    def use_s3_uploads(self) -> bool:
        return bool(self.cv_bucket) and not self.cv_bucket_conflict


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.cv_bucket_conflict:
        # Loud, because /health only reports a status string and this is the one
        # misconfiguration whose silent failure mode is a personal-data leak.
        logging.getLogger(__name__).error(
            "SURVEY_CV_BUCKET (%s) is the same bucket as S3_BUCKET, which serves "
            "community attachments over public URLs. Candidate CVs would be "
            "world-readable, so CV uploads are disabled. Point SURVEY_CV_BUCKET "
            "at a private bucket.",
            settings.cv_bucket,
        )
    return settings
