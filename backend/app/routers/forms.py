import json
import os

from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_admin
from ..models import SurveyForm
from ..storage import get_storage

router = APIRouter(prefix="/forms", tags=["forms"])

_DEFAULT_FORM_PATH = os.path.join(os.path.dirname(__file__), "..", "default_form.json")


def load_default_form() -> SurveyForm:
    with open(_DEFAULT_FORM_PATH, encoding="utf-8") as f:
        return SurveyForm.model_validate(json.load(f))


@router.get("/active", response_model=SurveyForm, response_model_by_alias=True)
def get_active_form() -> SurveyForm:
    form = get_storage().get_active_form()
    if form is None:
        form = load_default_form()
        get_storage().save_form(form)
    return form


@router.put("/{form_id}", response_model=SurveyForm, response_model_by_alias=True)
def save_form(form_id: str, form: SurveyForm, _admin: str = Depends(require_admin)) -> SurveyForm:
    if form.id != form_id:
        raise HTTPException(status_code=400, detail="Form id mismatch")
    return get_storage().save_form(form)
