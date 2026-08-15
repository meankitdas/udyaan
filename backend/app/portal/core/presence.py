"""Online presence and typing signals, backed by Redis.

Presence is deliberately *not* a database flag. A crashed browser tab never
sends a "went offline" event, so a stored boolean strands users as permanently
online. Instead each connection refreshes a short-lived key and absence of that
key is what "offline" means, which self-heals without any cleanup job.

Typing is fan-out rather than state: it is published to a channel and never
stored, because a typing indicator that outlives the keystroke that caused it is
worse than no indicator at all.
"""

import logging
from typing import Dict, Iterable, Optional

from app.portal.core.redis import get_redis

log = logging.getLogger(__name__)

# Browsers throttle setInterval in background tabs to roughly once a minute, so
# a TTL close to the heartbeat interval makes a backgrounded user flicker
# offline. Keep a wide margin over the client's 25s heartbeat.
PRESENCE_TTL_SECONDS = 150
HEARTBEAT_SECONDS = 25

_PRESENCE_KEY = "presence:{user_id}"
_TYPING_CHANNEL = "community:typing:{conversation_id}"
_EVENT_CHANNEL = "community:events:{user_id}"


def presence_key(user_id: str) -> str:
    return _PRESENCE_KEY.format(user_id=user_id)


def typing_channel(conversation_id: str) -> str:
    return _TYPING_CHANNEL.format(conversation_id=conversation_id)


def event_channel(user_id: str) -> str:
    return _EVENT_CHANNEL.format(user_id=user_id)


async def mark_online(user_id: str) -> None:
    """Refresh the caller's presence window. Called on connect and heartbeat."""
    try:
        redis = await get_redis()
        await redis.setex(presence_key(user_id), PRESENCE_TTL_SECONDS, "1")
    except Exception as exc:  # Presence is best-effort; never break the socket.
        log.debug("presence refresh failed for %s: %s", user_id, exc)


async def mark_offline(user_id: str) -> None:
    """Drop presence immediately on a clean disconnect."""
    try:
        redis = await get_redis()
        await redis.delete(presence_key(user_id))
    except Exception as exc:
        log.debug("presence clear failed for %s: %s", user_id, exc)


async def online_map(user_ids: Iterable[str]) -> Dict[str, bool]:
    """Which of these users currently hold a presence key."""
    ids = [uid for uid in user_ids if uid]
    if not ids:
        return {}
    try:
        redis = await get_redis()
        values = await redis.mget([presence_key(uid) for uid in ids])
    except Exception as exc:
        log.debug("presence lookup failed: %s", exc)
        return {uid: False for uid in ids}
    return {uid: value is not None for uid, value in zip(ids, values)}


async def is_online(user_id: str) -> bool:
    return (await online_map([user_id])).get(user_id, False)


async def publish_typing(
    conversation_id: str, user_id: str, is_typing: bool
) -> None:
    try:
        redis = await get_redis()
        await redis.publish(
            typing_channel(conversation_id),
            f"{user_id}:{1 if is_typing else 0}",
        )
    except Exception as exc:
        log.debug("typing publish failed: %s", exc)


async def publish_event(user_id: str, payload: str) -> None:
    """Push a JSON string to a specific user's live sockets."""
    try:
        redis = await get_redis()
        await redis.publish(event_channel(user_id), payload)
    except Exception as exc:
        log.debug("event publish failed for %s: %s", user_id, exc)


async def redis_or_none():
    """Redis client, or None when unconfigured, so callers can degrade."""
    try:
        return await get_redis()
    except Exception:
        return None
