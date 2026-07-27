"""Signed-URL uploads to Google Cloud Storage for community attachments.

The browser uploads straight to GCS rather than streaming through Cloud Run.
A 25MB PDF passing through the API would occupy a request worker for the whole
transfer, and Cloud Run bills for that wall time; GCS absorbs it for free.

Everything that matters about the upload is decided here, before signing, and
then baked into the signature:

* the object key is generated server-side, so a caller cannot choose a path and
  overwrite somebody else's file,
* ``content_type`` is part of the signed request, so the declared type is the
  only type that can be stored,
* ``x-goog-content-length-range`` is a signed header, so the size cap is
  enforced by GCS itself rather than trusting the client's declared size.

A signed URL that omitted these would be a bearer token for writing anything,
anywhere in the bucket.

Signing needs a private key, which Cloud Run's metadata credentials do not
expose. There, signing is delegated to the IAM ``signBlob`` API, which requires
the runtime service account to hold ``roles/iam.serviceAccountTokenCreator`` on
itself. With a local service-account JSON key, signing happens offline and no
IAM call is made.
"""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.portal.config import settings

# Deliberately narrow. Every entry is something a research finding or an
# achievement plausibly needs; anything executable or renderable as active
# content in a browser tab is excluded, since these files are served from a
# Google-owned origin under our bucket name.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "text/csv": ".csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class StorageUnavailable(RuntimeError):
    """Raised when no bucket is configured or the GCS client cannot be built."""


class UploadRejected(ValueError):
    """Raised when the requested upload fails validation before signing."""


def storage_enabled() -> bool:
    return bool(settings.GCS_BUCKET)


def max_upload_bytes() -> int:
    return int(settings.MAX_UPLOAD_BYTES)


def sanitize_filename(filename: str) -> str:
    """Reduce a user-supplied filename to something safe to echo back.

    This never becomes part of the object key -- it is only stored for display
    and used as the download filename -- but it is still user input that ends up
    in a Content-Disposition header and in the UI.
    """

    base = os.path.basename(filename or "").strip()
    base = _SAFE_NAME.sub("_", base).lstrip(".")
    if not base:
        base = "attachment"
    return base[:120]


def build_object_key(user_id: str, content_type: str) -> str:
    """Generate the object path. Never derived from client input.

    Namespacing by user id keeps a per-user prefix available for bulk cleanup
    when an account is removed.
    """

    extension = ALLOWED_CONTENT_TYPES.get(content_type, "")
    prefix = settings.GCS_UPLOAD_PREFIX.strip("/")
    return f"{prefix}/{user_id}/{uuid.uuid4().hex}{extension}"


def public_url(object_key: str) -> str:
    return f"https://storage.googleapis.com/{settings.GCS_BUCKET}/{object_key}"


def validate_upload(content_type: str, size: Optional[int]) -> None:
    """Reject anything we are not willing to sign for."""

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadRejected(
            f"Unsupported file type '{content_type}'. Allowed: PDF, images, CSV, "
            "Word, Excel, PowerPoint."
        )
    if size is not None:
        if size <= 0:
            raise UploadRejected("File appears to be empty.")
        if size > max_upload_bytes():
            limit_mb = max_upload_bytes() // (1024 * 1024)
            raise UploadRejected(f"File is larger than the {limit_mb}MB limit.")


def _signing_credentials():
    """Return the extra kwargs ``generate_signed_url`` needs to sign.

    A service-account JSON key can sign locally and needs nothing extra. The
    metadata-server credentials used on Cloud Run have no private key, so the
    email plus a fresh access token are supplied and the client routes the
    signature through the IAM signBlob API.
    """

    import google.auth
    from google.auth.transport import requests as google_requests
    from google.oauth2 import service_account

    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )

    if isinstance(credentials, service_account.Credentials):
        return credentials, {}

    credentials.refresh(google_requests.Request())
    email = getattr(credentials, "service_account_email", None)
    if not email or email == "default":
        # Impersonation is unavailable and there is no key: signing is impossible.
        raise StorageUnavailable(
            "No signing identity available. Run with a service account that has "
            "roles/iam.serviceAccountTokenCreator on itself."
        )
    return credentials, {
        "service_account_email": email,
        "access_token": credentials.token,
    }


def create_upload_url(user_id: str, filename: str, content_type: str, size: Optional[int]) -> dict:
    """Validate, then mint a short-lived signed PUT URL for a single object.

    Returns everything the client needs to perform the upload and then reference
    the result when creating the post.
    """

    # Validate the request before checking whether we can service it: a bad file
    # type is the caller's error regardless of deployment, and reporting the
    # deployment problem first would send them away to fix the wrong thing.
    validate_upload(content_type, size)

    if not storage_enabled():
        raise StorageUnavailable(
            "File uploads are not configured on this deployment. Add a link instead."
        )

    try:
        from google.cloud import storage
    except ImportError as exc:  # pragma: no cover - dependency is in requirements
        raise StorageUnavailable("google-cloud-storage is not installed.") from exc

    object_key = build_object_key(user_id, content_type)
    limit = max_upload_bytes()
    # Signed into the URL, so GCS rejects an oversized body even though the size
    # we validated above was only the client's claim.
    required_headers = {"x-goog-content-length-range": f"0,{limit}"}
    ttl = int(settings.GCS_SIGNED_URL_TTL_SECONDS)

    try:
        credentials, signer_kwargs = _signing_credentials()
        client = storage.Client(credentials=credentials)
        blob = client.bucket(settings.GCS_BUCKET).blob(object_key)
        upload_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=ttl),
            method="PUT",
            content_type=content_type,
            headers=required_headers,
            **signer_kwargs,
        )
    except StorageUnavailable:
        raise
    except Exception as exc:  # pragma: no cover - depends on cloud environment
        raise StorageUnavailable(f"Could not prepare the upload: {exc}") from exc

    return {
        "upload_url": upload_url,
        "file_url": public_url(object_key),
        "object_key": object_key,
        "method": "PUT",
        # The client must replay these verbatim; they are covered by the
        # signature and the upload 403s without them.
        "headers": {"Content-Type": content_type, **required_headers},
        "max_bytes": limit,
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=ttl),
    }


def is_managed_attachment(url: Optional[str]) -> bool:
    """True when a URL points at our own bucket.

    Guards against a client passing an arbitrary third-party URL as though it
    were an uploaded file.
    """

    if not url or not storage_enabled():
        return False
    return url.startswith(f"https://storage.googleapis.com/{settings.GCS_BUCKET}/")
