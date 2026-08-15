"""Transactional email via Amazon SES.

Replaces the previous ZeptoMail SMTP path. SES is reached with the App Runner
instance role, so there is no SMTP username/password to store or rotate.

A send never raises: signup, password reset and account provisioning all call
this, and none of them should fail because mail is misconfigured. Failures are
logged and reported through the return value.
"""

import logging
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi.concurrency import run_in_threadpool

from app.portal.config import settings

log = logging.getLogger(__name__)

_client = None


def _ses():
    """Lazily build the SES client so importing this module needs no credentials."""
    global _client
    if _client is None:
        _client = boto3.client(
            "sesv2", region_name=settings.SES_REGION or settings.AWS_REGION
        )
    return _client


def send_email(
    to_email: str, subject: str, body: str, html_content: Optional[str] = None
) -> bool:
    """Send one transactional email. Returns whether SES accepted it."""
    if not settings.MAIL_FROM:
        log.warning("Email not sent to %s: MAIL_FROM is not configured", to_email)
        return False

    content: dict = {"Text": {"Data": body, "Charset": "UTF-8"}}
    if html_content:
        content["Html"] = {"Data": html_content, "Charset": "UTF-8"}

    request = {
        "FromEmailAddress": (
            f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
            if settings.MAIL_FROM_NAME
            else settings.MAIL_FROM
        ),
        "Destination": {"ToAddresses": [to_email]},
        "Content": {
            "Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": content,
            }
        },
    }
    if settings.MAIL_REPLY_TO:
        request["ReplyToAddresses"] = [settings.MAIL_REPLY_TO]
    if settings.SES_CONFIGURATION_SET:
        request["ConfigurationSetName"] = settings.SES_CONFIGURATION_SET

    try:
        response = _ses().send_email(**request)
    except (BotoCoreError, ClientError) as exc:
        # Covers unverified identity, sandbox restrictions and missing credentials,
        # which are the three ways this fails in practice.
        log.warning("SES send to %s failed: %s", to_email, exc)
        return False

    log.info("SES accepted message %s for %s", response.get("MessageId"), to_email)
    return True


async def asend_email(
    to_email: str, subject: str, body: str, html_content: Optional[str] = None
) -> bool:
    """Async callers must use this: boto3 is synchronous and blocks the loop."""
    return await run_in_threadpool(send_email, to_email, subject, body, html_content)
