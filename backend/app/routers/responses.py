from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import require_admin
from ..config import get_settings
from ..models import DownloadTicket, SurveyResponse
from ..rag.evaluator import compute_quiz_score
from ..routers.forms import load_default_form
from ..storage import get_storage
from ..uploads import (
    UploadRejected,
    UploadsUnavailable,
    create_download_url,
    delete_object,
    is_managed_key,
    object_exists,
    sanitize_filename,
)

router = APIRouter(prefix="/responses", tags=["responses"])


def _clean_files(response: SurveyResponse) -> None:
    """Drop attachment references we cannot vouch for.

    The submission arrives from an anonymous client, so its ``files`` map is
    untrusted: a key outside our prefix would point the admin download at an
    arbitrary object, and a key for an upload that never completed would offer a
    download that 404s. Both are dropped here rather than at read time, so the
    stored response stays truthful about what exists.
    """

    kept: dict = {}
    for question_id, file in (response.files or {}).items():
        if not is_managed_key(file.object_key):
            continue
        size = object_exists(file.object_key)
        if size is None:
            continue
        file.name = sanitize_filename(file.name)
        file.size = size
        kept[question_id] = file
    response.files = kept


@router.post("", response_model=SurveyResponse, response_model_by_alias=True)
def submit_response(response: SurveyResponse) -> SurveyResponse:
    # Recompute the score server-side; never trust the client's value.
    form = get_storage().get_active_form() or load_default_form()
    score, max_score = compute_quiz_score(form, response)
    response.score = score
    response.max_score = max_score
    response.evaluation = None
    _clean_files(response)
    return get_storage().add_response(response)


@router.get("", response_model=list[SurveyResponse], response_model_by_alias=True)
def list_responses(_admin: str = Depends(require_admin)) -> list[SurveyResponse]:
    return get_storage().list_responses()


@router.get(
    "/{response_id}/files/{question_id}",
    response_model=DownloadTicket,
    response_model_by_alias=True,
)
def download_response_file(
    response_id: str, question_id: str, _admin: str = Depends(require_admin)
) -> DownloadTicket:
    """Hand an admin a short-lived link to one candidate's uploaded file.

    The link is minted per request instead of being stored on the response so the
    objects can stay private: an expired URL is useless to anyone who copies it.
    """

    response = get_storage().get_response(response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    file = (response.files or {}).get(question_id)
    if file is None or not file.object_key:
        raise HTTPException(
            status_code=404,
            detail="No stored file for this answer. It was submitted before uploads were enabled.",
        )
    try:
        url = create_download_url(file.object_key, file.name, file.content_type)
    except UploadRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UploadsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return DownloadTicket(
        url=url, file_name=file.name, expires_in=get_settings().signed_url_ttl_seconds
    )


@router.delete("/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_response(response_id: str, _admin: str = Depends(require_admin)) -> Response:
    """Remove a candidate and any file they uploaded.

    The objects are deleted first so the common case does not leave a key behind
    with nothing pointing at it. That is best-effort, not a guarantee: the delete
    is swallowed on failure rather than blocking the admin's action, and a
    candidate who replaces or abandons a CV mid-survey orphans the earlier object
    with no request reaching us at all. Reclaiming those needs a lifecycle rule
    on the bucket prefix -- see the CV uploads section of the backend README.
    """

    storage = get_storage()
    response = storage.get_response(response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    for file in (response.files or {}).values():
        delete_object(file.object_key)
    storage.delete_response(response_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
