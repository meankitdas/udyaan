"""Presigned CV uploads for candidates.

Unauthenticated by design: the survey is filled in by anonymous applicants, so
there is no token to check. What keeps it from being an open write endpoint is
the signature -- see ``app.uploads`` -- which pins the key, the content type and
the size before anything can be stored.
"""

from fastapi import APIRouter, HTTPException, status

from ..models import UploadRequest, UploadTicket
from ..uploads import UploadRejected, UploadsUnavailable, create_upload_url, uploads_enabled

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.get("/status")
def upload_status() -> dict:
    """Lets the survey UI tell candidates upfront whether a CV can be attached."""
    return {"enabled": uploads_enabled()}


@router.post("/cv", response_model=UploadTicket, response_model_by_alias=True)
def create_cv_upload(body: UploadRequest) -> UploadTicket:
    try:
        ticket = create_upload_url(body.filename, body.content_type, body.size)
    except UploadRejected as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except UploadsUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return UploadTicket.model_validate(ticket)
