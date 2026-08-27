"""Candidate CV storage on Amazon S3.

The survey used to record only the file *name* a candidate picked, so an admin
reviewing an application had nothing to open. The bytes now go to S3, and the
response carries a reference to the stored object.

The browser uploads straight to S3 with a presigned POST rather than streaming
through this API: a CV upload would otherwise hold a request worker for the whole
transfer. Everything that matters is decided here, before signing, and is baked
into the signature:

* the object key is generated server-side, so a caller cannot pick a path and
  overwrite another candidate's file,
* ``content_type`` is signed, so the declared type is the only type that stores,
* ``content-length-range`` is a policy condition, so S3 itself enforces the size
  cap instead of us trusting the client's declared size.

The upload endpoint is unauthenticated because candidates are anonymous, which is
also why the allow-list is narrow (CV document formats only) and why objects are
never publicly readable: admins download through a short-lived presigned GET
minted only after the bearer token is checked. That last guarantee rests on the
bucket actually being private, which is why `SURVEY_CV_BUCKET` has no fallback to
the portal's public attachment bucket -- see `app.config`.

Note what the signature does and does not bound. It pins one object's key, type
and size, so no single ticket can be abused -- but nothing here limits how many
tickets an anonymous caller can mint, and an object that no submission ever
references is not reclaimed by any code path. Both are deployment concerns: put a
lifecycle expiration on the prefix, and rate-limit the endpoint at the edge. See
the CV uploads section of the backend README.
"""

from __future__ import annotations

import os
import re
import uuid
from typing import Optional

from .config import get_settings

# CV formats only. Anything a browser would render as active content is excluded
# because these objects are served from an AWS-owned origin under our bucket.
ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class UploadsUnavailable(RuntimeError):
    """Raised when no bucket is configured or the S3 client cannot be built."""


class UploadRejected(ValueError):
    """Raised when the requested upload fails validation before signing."""


def uploads_enabled() -> bool:
    return get_settings().use_s3_uploads


def max_upload_bytes() -> int:
    return get_settings().max_cv_bytes


def sanitize_filename(filename: str) -> str:
    """Reduce a candidate-supplied filename to something safe to echo back.

    This never becomes part of the object key -- it is stored for display and
    used as the download filename -- but it still lands in a Content-Disposition
    header and in the admin UI, so it is scrubbed.
    """

    base = os.path.basename(filename or "").strip()
    base = _SAFE_NAME.sub("_", base).lstrip(".")
    if not base:
        base = "cv"
    return base[:120]


def _prefix() -> str:
    return get_settings().cv_upload_prefix.strip("/") or "survey-cv"


def build_object_key(content_type: str) -> str:
    """Generate the object path. Never derived from client input."""

    extension = ALLOWED_CONTENT_TYPES.get(content_type, "")
    return f"{_prefix()}/{uuid.uuid4().hex}{extension}"


def is_managed_key(object_key: Optional[str]) -> bool:
    """True when a key looks like one this module minted.

    A response is submitted by an anonymous client, so the key it claims for its
    CV is untrusted input; without this check a submission could point the admin
    download at any object in the bucket.
    """

    if not object_key:
        return False
    if ".." in object_key or object_key.startswith("/"):
        return False
    return object_key.startswith(f"{_prefix()}/")


def validate_upload(content_type: str, size: Optional[int]) -> None:
    """Reject anything we are not willing to sign for."""

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadRejected(
            f"Unsupported file type '{content_type}'. Upload a PDF or Word document."
        )
    if size is not None:
        if size <= 0:
            raise UploadRejected("File appears to be empty.")
        if size > max_upload_bytes():
            limit_mb = max_upload_bytes() // (1024 * 1024)
            raise UploadRejected(f"File is larger than the {limit_mb}MB limit.")


def _client():
    """Build an S3 client, or explain why uploads cannot be served.

    Credentials come from the standard botocore chain, which on App Runner is the
    instance role, so nothing has to ship with the image.

    The endpoint is pinned to the bucket's region rather than left to the global
    ``s3.amazonaws.com``. A bucket outside us-east-1 answers the global endpoint
    with a 307 to its regional one until DNS propagates, which is fatal here: the
    browser is doing a cross-origin POST, and it will not replay a multipart body
    to a redirect target that has not itself cleared CORS preflight. Signing
    against the regional host makes the upload a single request.
    """
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover - dependency is in requirements
        raise UploadsUnavailable("boto3 is not installed.") from exc

    region = get_settings().aws_region
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=f"https://s3.{region}.amazonaws.com",
        # SigV4 so the presigned policy is accepted in every region.
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def create_upload_url(filename: str, content_type: str, size: Optional[int]) -> dict:
    """Validate, then mint a short-lived presigned POST for a single CV."""

    # Validate before checking whether we can service the request: a bad file
    # type is the caller's error regardless of deployment, and reporting the
    # deployment problem first would send them off to fix the wrong thing.
    validate_upload(content_type, size)

    if not uploads_enabled():
        raise UploadsUnavailable(
            "CV uploads are not configured on this deployment "
            "(SURVEY_CV_BUCKET must name a private bucket)."
        )

    settings = get_settings()
    object_key = build_object_key(content_type)
    limit = max_upload_bytes()
    ttl = settings.signed_url_ttl_seconds

    try:
        presigned = _client().generate_presigned_post(
            Bucket=settings.cv_bucket,
            Key=object_key,
            Fields={"Content-Type": content_type},
            # Both conditions are signed into the policy. Without the explicit
            # Content-Type match a client could declare one type and store
            # another; without the range it could ignore the size limit.
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, limit],
            ],
            ExpiresIn=ttl,
        )
    except UploadsUnavailable:
        raise
    except Exception as exc:  # pragma: no cover - depends on cloud environment
        raise UploadsUnavailable(f"Could not prepare the upload: {exc}") from exc

    return {
        "uploadUrl": presigned["url"],
        # Sent as multipart form fields with the file appended last; they are
        # covered by the policy signature and the upload 403s without them.
        "fields": presigned["fields"],
        "objectKey": object_key,
        "fileName": sanitize_filename(filename),
        "contentType": content_type,
        "maxBytes": limit,
    }


def object_exists(object_key: str) -> Optional[int]:
    """Return the stored size, or None when the object is missing/unreadable.

    Used to drop CV references that point at nothing, so the admin console never
    offers a download that would 404.
    """

    if not uploads_enabled() or not is_managed_key(object_key):
        return None
    try:
        head = _client().head_object(Bucket=get_settings().cv_bucket, Key=object_key)
        return int(head.get("ContentLength", 0))
    except Exception:  # pragma: no cover - depends on cloud environment
        return None


def create_download_url(object_key: str, filename: str, content_type: str = "") -> str:
    """Mint a short-lived presigned GET that downloads as an attachment."""

    if not uploads_enabled():
        raise UploadsUnavailable("CV uploads are not configured on this deployment.")
    if not is_managed_key(object_key):
        raise UploadRejected("Not a candidate CV object.")

    settings = get_settings()
    params = {
        "Bucket": settings.cv_bucket,
        "Key": object_key,
        # Forces a download with the candidate's original filename rather than
        # the opaque uuid key, and stops a PDF rendering inline on our origin.
        "ResponseContentDisposition": f'attachment; filename="{sanitize_filename(filename)}"',
    }
    if content_type:
        params["ResponseContentType"] = content_type
    try:
        return _client().generate_presigned_url(
            "get_object", Params=params, ExpiresIn=settings.signed_url_ttl_seconds
        )
    except Exception as exc:  # pragma: no cover - depends on cloud environment
        raise UploadsUnavailable(f"Could not prepare the download: {exc}") from exc


def delete_object(object_key: str) -> None:
    """Best-effort delete; a failure must not block removing the candidate."""

    if not uploads_enabled() or not is_managed_key(object_key):
        return
    try:
        _client().delete_object(Bucket=get_settings().cv_bucket, Key=object_key)
    except Exception:  # pragma: no cover - depends on cloud environment
        import logging

        logging.getLogger(__name__).warning("Could not delete CV object %s", object_key)
