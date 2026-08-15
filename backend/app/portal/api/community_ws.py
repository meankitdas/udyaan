"""Live presence, typing indicators and message pushes over WebSocket.

Auth uses the ``Sec-WebSocket-Protocol`` header rather than a query parameter:
browsers cannot set arbitrary headers on a WebSocket handshake, and a token in
the query string ends up in access logs, proxy logs and referrers.

Every socket subscribes to two Redis channels — its own user event channel and
the conversation it currently has open — so a message sent on one App Runner
instance reaches a socket held by another.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import update

from app.portal.core import presence
from app.portal.core.deps import decode_token
from app.portal.models.user import User
from app.portal import database as portal_db

log = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["community-presence"])

# Clients send {"type": "..."} frames; anything larger is a protocol abuse.
MAX_FRAME_BYTES = 4096


def _token_from_subprotocols(websocket: WebSocket) -> Optional[str]:
    """Read ``Sec-WebSocket-Protocol: bearer, <jwt>``."""
    raw = websocket.headers.get("sec-websocket-protocol")
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) >= 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


async def _touch_last_seen(user_id: str) -> None:
    if portal_db.AsyncSessionLocal is None:
        return
    try:
        async with portal_db.AsyncSessionLocal() as db:
            await db.execute(
                update(User).where(User.id == user_id).values(last_seen_at=datetime.utcnow())
            )
            await db.commit()
    except Exception as exc:
        log.debug("last_seen update failed for %s: %s", user_id, exc)


@router.websocket("/ws")
async def community_socket(websocket: WebSocket) -> None:
    token = _token_from_subprotocols(websocket)
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_token(token, "access")
        email = payload.get("sub")
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if not email:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await _load_user(email)
    if user is None or user.is_active is False:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user_id = user.id

    # Echo the subprotocol back or the browser rejects the handshake.
    await websocket.accept(subprotocol="bearer")

    redis = await presence.redis_or_none()
    if redis is None:
        # Without Redis there is no cross-instance fan-out; say so rather than
        # pretending to be live.
        await websocket.send_json({"type": "degraded", "reason": "presence_unavailable"})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    await presence.mark_online(user_id)
    pubsub = redis.pubsub()
    await pubsub.subscribe(presence.event_channel(user_id))
    subscribed_conversation: Optional[str] = None

    async def pump_redis() -> None:
        """Forward Redis pub/sub messages to this socket."""
        async for item in pubsub.listen():
            if item.get("type") != "message":
                continue
            channel = item.get("channel") or ""
            data = item.get("data") or ""
            if channel.startswith("community:typing:"):
                conversation_id = channel.rsplit(":", 1)[-1]
                sender, _, flag = data.partition(":")
                if sender == user_id:
                    continue  # Never echo the typist back to themselves.
                await websocket.send_json(
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": sender,
                        "is_typing": flag == "1",
                    }
                )
            else:
                try:
                    await websocket.send_json(json.loads(data))
                except json.JSONDecodeError:
                    continue

    pump = asyncio.create_task(pump_redis())

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw) > MAX_FRAME_BYTES:
                continue
            try:
                frame = json.loads(raw)
            except json.JSONDecodeError:
                continue

            kind = frame.get("type")

            if kind == "heartbeat":
                await presence.mark_online(user_id)
                await websocket.send_json({"type": "heartbeat_ack"})

            elif kind == "watch":
                # Swap which conversation's typing channel this socket follows.
                conversation_id = str(frame.get("conversation_id") or "")
                if subscribed_conversation:
                    await pubsub.unsubscribe(
                        presence.typing_channel(subscribed_conversation)
                    )
                    subscribed_conversation = None
                if conversation_id:
                    await pubsub.subscribe(presence.typing_channel(conversation_id))
                    subscribed_conversation = conversation_id

            elif kind == "typing":
                conversation_id = str(frame.get("conversation_id") or "")
                if conversation_id:
                    await presence.publish_typing(
                        conversation_id, user_id, bool(frame.get("is_typing"))
                    )

            elif kind == "presence":
                wanted = [str(u) for u in (frame.get("user_ids") or [])][:100]
                await websocket.send_json(
                    {"type": "presence", "online": await presence.online_map(wanted)}
                )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.debug("socket error for %s: %s", user_id, exc)
    finally:
        pump.cancel()
        try:
            await pubsub.unsubscribe()
            await pubsub.close()
        except Exception:
            pass
        await presence.mark_offline(user_id)
        await _touch_last_seen(user_id)


async def _load_user(email: str) -> Optional[User]:
    from sqlalchemy.future import select

    if portal_db.AsyncSessionLocal is None:
        portal_db._init_db_sync()
    async with portal_db.AsyncSessionLocal() as db:
        return (
            await db.execute(select(User).where(User.email == email))
        ).scalars().first()
