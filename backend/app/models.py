"""Pydantic models mirroring the frontend TypeScript types (camelCase wire format)."""

from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class Question(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    type: Literal[
        "statement", "text", "longtext", "email", "phone", "select", "choice", "multichoice", "file"
    ]
    label: str
    description: Optional[str] = None
    placeholder: Optional[str] = None
    required: Optional[bool] = None
    options: Optional[list[str]] = None
    correct_option: Optional[str] = Field(default=None, alias="correctOption")
    points: Optional[int] = None
    image: Optional[str] = None


class SurveySection(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    heading: str
    subheading: Optional[str] = None
    icon: str = "leaf"
    questions: list[Question] = []


class SurveyForm(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    subtitle: str = ""
    published: bool = True
    collect_emails: bool = Field(default=True, alias="collectEmails")
    updated_at: str = Field(default="", alias="updatedAt")
    sections: list[SurveySection] = []


class QuestionTiming(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question_id: str = Field(alias="questionId")
    active_ms: float = Field(alias="activeMs")
    visits: int = 0
    changes: int = 0


class Evaluation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    verdict: Literal["shortlist", "review", "reject"]
    score: int
    reasoning: str
    criteria: dict[str, int] = {}
    strengths: list[str] = []
    concerns: list[str] = []
    timing_analysis: str = Field(default="", alias="timingAnalysis")
    cohort_rank: Optional[int] = Field(default=None, alias="cohortRank")
    cohort_size: Optional[int] = Field(default=None, alias="cohortSize")
    cohort_percentile: Optional[float] = Field(default=None, alias="cohortPercentile")
    evaluated_at: str = Field(default="", alias="evaluatedAt")
    model: str = ""


class ResponseFile(BaseModel):
    """A file a candidate attached to one question (currently the CV).

    The answer value keeps the filename so the text stays readable to the
    screening prompt and the answer list; this carries the pointer to the bytes.
    """

    model_config = ConfigDict(populate_by_name=True)

    name: str
    size: int = 0
    content_type: str = Field(default="", alias="contentType")
    object_key: str = Field(default="", alias="objectKey")
    uploaded_at: str = Field(default="", alias="uploadedAt")


class SurveyResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    form_id: str = Field(alias="formId")
    answers: dict[str, Union[str, list[str]]]
    files: dict[str, ResponseFile] = {}
    timings: list[QuestionTiming] = []
    started_at: str = Field(alias="startedAt")
    submitted_at: str = Field(alias="submittedAt")
    total_ms: float = Field(alias="totalMs")
    score: Optional[int] = None
    max_score: Optional[int] = Field(default=None, alias="maxScore")
    evaluation: Optional[Evaluation] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UploadRequest(BaseModel):
    """A candidate asking for somewhere to put a CV, before the form is submitted."""

    model_config = ConfigDict(populate_by_name=True)

    filename: str
    content_type: str = Field(alias="contentType")
    size: Optional[int] = None


class UploadTicket(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    upload_url: str = Field(alias="uploadUrl")
    fields: dict[str, str] = {}
    object_key: str = Field(alias="objectKey")
    file_name: str = Field(alias="fileName")
    content_type: str = Field(alias="contentType")
    max_bytes: int = Field(alias="maxBytes")


class DownloadTicket(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: str
    file_name: str = Field(alias="fileName")
    expires_in: int = Field(alias="expiresIn")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
