import datetime as dt
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProblemStatus(str, Enum):
    NEW = "new"
    REVIEWING = "reviewing"
    CONTACTED = "contacted"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class ProblemBrief(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid", populate_by_name=True)

    request_id: UUID = Field(alias="requestId")
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=160)
    organisation: str = Field(min_length=1, max_length=140)
    title: str = Field(min_length=8, max_length=120)
    context: str = Field(min_length=30, max_length=1800)
    success: str = Field(min_length=20, max_length=1000)
    constraints: str = Field(default="", max_length=1000)
    consent: Literal[True]


class ProblemReceipt(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    submitted_at: dt.datetime = Field(alias="submittedAt")


class ProblemSubmission(ProblemReceipt):
    name: str
    email: str
    organisation: str
    title: str
    context: str
    success: str
    constraints: str
    consent: bool
    status: ProblemStatus
    notes: str = ""
    reviewed_at: dt.datetime | None = Field(default=None, alias="reviewedAt")
    reviewed_by: str | None = Field(default=None, alias="reviewedBy")
    version: int = 1


class ProblemReview(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    status: ProblemStatus
    notes: str = Field(default="", max_length=5000)
    version: int = Field(ge=1)


class ProblemPage(BaseModel):
    items: list[ProblemSubmission]
    total: int
    page: int
    page_size: int = Field(default=25, alias="pageSize")