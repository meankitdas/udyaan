"""Azure OpenAI client for the portal's AI features.

Mirrors the survey backend's approach: use Azure OpenAI when configured, and
degrade gracefully to a deterministic extractive mode otherwise, so the whole
feature set stays demoable on a laptop without cloud credentials.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache, partial
from typing import Any, Optional

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)


class LLM:
    """Thin wrapper around Azure OpenAI chat completions with tool calling."""

    def __init__(self) -> None:
        from app.config import get_settings

        self._settings = get_settings()
        self._client = None
        if self._settings.use_azure_openai:
            try:
                from openai import AzureOpenAI

                self._client = AzureOpenAI(
                    azure_endpoint=self._settings.azure_openai_endpoint,
                    api_key=self._settings.azure_openai_api_key,
                    api_version=self._settings.azure_openai_api_version,
                )
            except Exception as exc:  # pragma: no cover - never break the API
                logger.warning("Azure OpenAI unavailable, using fallback mode: %s", exc)

    @property
    def available(self) -> bool:
        return self._client is not None

    @property
    def model(self) -> str:
        return self._settings.azure_chat_deployment if self._client else "heuristic-fallback"

    def chat(
        self,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        json_mode: bool = False,
        temperature: float = 0.2,
        max_tokens: int = 900,
    ) -> Any:
        """Return the raw assistant message, or None when the LLM is unavailable."""
        if self._client is None:
            return None

        kwargs: dict[str, Any] = {
            "model": self._settings.azure_chat_deployment,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        completion = self._client.chat.completions.create(**kwargs)
        return completion.choices[0].message

    def json(self, system: str, user: str, max_tokens: int = 900) -> Optional[dict]:
        """Structured-output helper. Returns parsed JSON or None."""
        message = self.chat(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            json_mode=True,
            max_tokens=max_tokens,
        )
        if message is None or not message.content:
            return None
        try:
            return json.loads(message.content)
        except json.JSONDecodeError:
            logger.warning("LLM returned non-JSON content")
            return None

    # ---- async wrappers -------------------------------------------------
    #
    # The Azure SDK client is synchronous. Calling it straight from an async
    # endpoint pins the event loop for the whole completion -- measured at ~7s,
    # during which every other request on the service (including /health) also
    # waits. These push the blocking call onto a worker thread so one person
    # generating a review doesn't stall everyone else.

    async def ajson(self, system: str, user: str, max_tokens: int = 900) -> Optional[dict]:
        return await run_in_threadpool(self.json, system, user, max_tokens)

    async def achat(
        self,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        json_mode: bool = False,
        temperature: float = 0.2,
        max_tokens: int = 900,
    ) -> Any:
        return await run_in_threadpool(
            partial(
                self.chat,
                messages,
                tools=tools,
                json_mode=json_mode,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        )


@lru_cache
def get_llm() -> LLM:
    return LLM()
