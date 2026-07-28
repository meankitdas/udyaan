"""Presigned uploads to Amazon S3 for community attachments.

The browser uploads straight to S3 rather than streaming through the API.
A 25MB PDF passing through the service would occupy a request worker for the
whole transfer, and App Runner bills for that wall time; S3 absorbs it for free.

Everything that matters about the upload is decided here, before signing, and
then baked into the signature:

* the object key is generated server-side, so a caller cannot choose a path and
  overwrite somebody else's file,
* ``content_type`` is part of the signed request, so the declared type is the
  only type that can be stored,
* ``content-length-range`` is a policy condition, so the size cap is enforced by
  S3 itself rather than trusting the client's declared size.

A presigned URL that omitted these would be a bearer token for writing anything,
anywhere in the bucket.

This uses a presigned **POST** rather than a presigned PUT. A presigned PUT
would be a smaller change on the client, but its signature cannot cover the body
length, so the size cap would degrade to whatever the client chose to declare.
Only the POST policy can bind the limit, and that guarantee is the reason the
upload path is server-mediated at all.

Signing is offline: botocore derives it from the caller's credentials, so unlike
the GCS equivalent there is no IAM round trip and no key to distribute.
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
# content in a browser tab is excluded, since these files are served from an
# AWS-owned origin under our bucket name.
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
    """Raised when no bucket is configured or the S3 client cannot be built."""


class UploadRejected(ValueError):
    """Raised when the requested upload fails validation before signing."""


def storage_enabled() -> bool:
    return bool(settings.S3_BUCKET)


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
    prefix = settings.S3_UPLOAD_PREFIX.strip("/")
    return f"{prefix}/{user_id}/{uuid.uuid4().hex}{extension}"


def _bucket_origin() -> str:
    return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com"


def public_url(object_key: str) -> str:
    return f"{_bucket_origin()}/{object_key}"


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


def _client():
    """Build an S3 client, or explain why uploads cannot be served.

    Credentials come from the standard botocore chain, which on App Runner is
    the instance role, so nothing has to be distributed with the image.
    """
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover - dependency is in requirements
        raise StorageUnavailable("boto3 is not installed.") from exc

    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        # SigV4 so the presigned policy is accepted in every region, including
        # those that never supported the older signature.
        config=Config(signature_version="s3v4"),
    )


def create_upload_url(user_id: str, filename: str, content_type: str, size: Optional[int]) -> dict:
    """Validate, then mint a short-lived presigned POST for a single object.

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

    object_key = build_object_key(user_id, content_type)
    limit = max_upload_bytes()
    ttl = int(settings.S3_SIGNED_URL_TTL_SECONDS)

    try:
        client = _client()
        presigned = client.generate_presigned_post(
            Bucket=settings.S3_BUCKET,
            Key=object_key,
            Fields={"Content-Type": content_type},
            # Both conditions are signed into the policy. Without the explicit
            # Content-Type match a client could declare one type and store
            # another; without the range it could ignore the size limit entirely.
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, limit],
            ],
            ExpiresIn=ttl,
        )
    except StorageUnavailable:
        raise
    except Exception as exc:  # pragma: no cover - depends on cloud environment
        raise StorageUnavailable(f"Could not prepare the upload: {exc}") from exc

    return {
        "upload_url": presigned["url"],
        "file_url": public_url(object_key),
        "object_key": object_key,
        "method": "POST",
        # Sent as multipart form fields, with the file appended last. They are
        # covered by the policy signature and the upload 403s without them.
        "fields": presigned["fields"],
        # No signed headers in the POST flow; kept so the response shape stays
        # stable for clients that read it.
        "headers": {},
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
    return url.startswith(f"{_bucket_origin()}/")
