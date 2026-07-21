from fastapi import APIRouter, Depends

from ..auth import require_admin
from ..models import SurveyResponse
from ..rag.evaluator import compute_quiz_score
from ..routers.forms import load_default_form
from ..storage import get_storage

router = APIRouter(prefix="/responses", tags=["responses"])


@router.post("", response_model=SurveyResponse, response_model_by_alias=True)
def submit_response(response: SurveyResponse) -> SurveyResponse:
    # Recompute the score server-side; never trust the client's value.
    form = get_storage().get_active_form() or load_default_form()
    score, max_score = compute_quiz_score(form, response)
    response.score = score
    response.max_score = max_score
    response.evaluation = None
    return get_storage().add_response(response)


@router.get("", response_model=list[SurveyResponse], response_model_by_alias=True)
def list_responses(_admin: str = Depends(require_admin)) -> list[SurveyResponse]:
    return get_storage().list_responses()
