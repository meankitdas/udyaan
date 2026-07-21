from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_admin
from ..models import Evaluation, SurveyResponse
from ..rag.evaluator import calibrate_cohort, evaluate_response
from ..routers.forms import load_default_form
from ..storage import get_storage

router = APIRouter(prefix="/screening", tags=["screening"])


@router.post("/evaluate/{response_id}", response_model=Evaluation, response_model_by_alias=True)
def evaluate(response_id: str, _admin: str = Depends(require_admin)) -> Evaluation:
    storage = get_storage()
    response = storage.get_response(response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    form = storage.get_active_form() or load_default_form()
    evaluation = evaluate_response(form, response)
    response.evaluation = evaluation
    storage.update_response(response)
    return evaluation


@router.post("/evaluate-all", response_model=list[Evaluation], response_model_by_alias=True)
def evaluate_all(_admin: str = Depends(require_admin)) -> list[Evaluation]:
    storage = get_storage()
    form = storage.get_active_form() or load_default_form()
    results: list[Evaluation] = []
    for response in storage.list_responses():
        if response.evaluation is not None:
            continue
        evaluation = evaluate_response(form, response)
        response.evaluation = evaluation
        storage.update_response(response)
        results.append(evaluation)
    return results


@router.post("/calibrate", response_model=list[SurveyResponse], response_model_by_alias=True)
def calibrate(_admin: str = Depends(require_admin)) -> list[SurveyResponse]:
    storage = get_storage()
    responses = storage.list_responses()
    calibrate_cohort(responses)
    storage.update_responses([response for response in responses if response.evaluation is not None])
    return responses
