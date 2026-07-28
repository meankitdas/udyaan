"""Data access for direct messaging.

Three rules hold this together:

*Gating is checked on conversation creation, not on every send.* An accepted
connection is what authorises a thread. Re-checking on each message would mean a
connection being withdrawn silently breaks an existing conversation mid-sentence
and drops history that both people can still see. Withdrawal stops new threads;
it does not retroactively erase one.

*Conversation creation is idempotent by construction.* ``get_or_create`` inserts
on the ``pair_key`` unique constraint and falls back to a re-read when the insert
conflicts. Two simultaneous "Message" taps therefore converge on one row instead
of racing to create two half-histories.

*Unread counts are recomputed, never adjusted.* ``recount_unread`` derives the
number from messages newer than ``last_read_at``. Incrementing on send and
decrementing on read looks cheaper right up until a retry double-counts, and a
badge that is permanently wrong is not recoverable without this query anyway.
"""

import base64
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.crud import community as community_crud
from app.portal.models.community_message import (
    Conversation,
    ConversationParticipant,
    Message,
    pair_key_for,
)
from app.portal.models.user import User
from app.portal.schemas.community_message import (
    PREVIEW_LENGTH,
    ConversationOut,
    MessageOut,
)
from app.portal.schemas.community_post import AttachmentOut


class NotConnected(Exception):
    """Raised when two users have no accepted connection between them."""


def utcnow() -> datetime:
    """Naive UTC, matching the timezone-less TIMESTAMP columns.

    Writing an aware datetime into these columns makes asyncpg raise when it
    later subtracts them ("can't subtract offset-naive and offset-aware").
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# --------------------------------------------------------------------------
# Cursors
# --------------------------------------------------------------------------

def encode_cursor(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def decode_cursor(cursor: Optional[str]) -> Optional[str]:
    """Decode a cursor; anything malformed restarts rather than 500s."""
    if not cursor:
        return None
    try:
        padding = "=" * (-len(cursor) % 4)
        return base64.urlsafe_b64decode(cursor + padding).decode()
    except Exception:
        return None


def decode_time_cursor(cursor: Optional[str]) -> Optional[datetime]:
    raw = decode_cursor(cursor)
    if not raw or not raw.startswith("t:"):
        return None
    try:
        parsed = datetime.fromisoformat(raw[2:])
    except ValueError:
        return None
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


def encode_time_cursor(value: datetime) -> str:
    return encode_cursor(f"t:{value.isoformat()}")


# --------------------------------------------------------------------------
# Conversations
# --------------------------------------------------------------------------

async def get_or_create_conversation(
    db: AsyncSession, viewer_id: str, other_id: str
) -> Conversation:
    """Return the thread between two users, creating it if they are connected."""
    if viewer_id == other_id:
        raise NotConnected("You cannot message yourself.")

    key = pair_key_for(viewer_id, other_id)

    existing = await db.execute(
        select(Conversation).where(Conversation.pair_key == key)
    )
    conversation = existing.scalar_one_or_none()
    if conversation is not None:
        return conversation

    partners = await community_crud.get_accepted_partner_ids(db, viewer_id)
    if other_id not in partners:
        raise NotConnected("You can only message people you are connected with.")

    conversation = Conversation(pair_key=key)
    db.add(conversation)
    try:
        await db.flush()
    except IntegrityError:
        # Lost the race against a simultaneous first message from the other
        # side. Their row is the winner; adopt it rather than failing the send.
        await db.rollback()
        again = await db.execute(
            select(Conversation).where(Conversation.pair_key == key)
        )
        found = again.scalar_one_or_none()
        if found is None:
            raise
        return found

    db.add_all(
        [
            ConversationParticipant(conversation_id=conversation.id, user_id=viewer_id),
            ConversationParticipant(conversation_id=conversation.id, user_id=other_id),
        ]
    )
    await db.flush()
    return conversation


async def get_participant(
    db: AsyncSession, conversation_id: UUID, user_id: str
) -> Optional[ConversationParticipant]:
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_other_participant_ids(
    db: AsyncSession, conversation_ids: Sequence[UUID], viewer_id: str
) -> Dict[UUID, str]:
    """Map each conversation to the id of the person who is not the viewer."""
    if not conversation_ids:
        return {}
    result = await db.execute(
        select(
            ConversationParticipant.conversation_id,
            ConversationParticipant.user_id,
        ).where(
            ConversationParticipant.conversation_id.in_(list(conversation_ids)),
            ConversationParticipant.user_id != viewer_id,
        )
    )
    return {row[0]: row[1] for row in result}


async def build_conversation_outputs(
    db: AsyncSession,
    conversations: Sequence[Conversation],
    participants: Dict[UUID, ConversationParticipant],
    viewer_id: str,
) -> List[ConversationOut]:
    """Assemble inbox rows, batching the profile lookups across the whole page."""
    if not conversations:
        return []

    ids = [c.id for c in conversations]
    other_ids = await get_other_participant_ids(db, ids, viewer_id)

    users: Dict[str, User] = {}
    wanted = {uid for uid in other_ids.values()}
    if wanted:
        result = await db.execute(select(User).where(User.id.in_(list(wanted))))
        rows = list(result.scalars())
        summaries = await community_crud.build_summaries(db, rows, viewer_id)
        users = {s.id: s for s in summaries}

    out: List[ConversationOut] = []
    for conv in conversations:
        participant = participants.get(conv.id)
        other_id = other_ids.get(conv.id)
        out.append(
            ConversationOut(
                id=conv.id,
                other=users.get(other_id) if other_id else None,
                last_message_preview=conv.last_message_preview,
                last_message_at=conv.last_message_at,
                last_message_is_mine=conv.last_message_sender_id == viewer_id,
                unread_count=participant.unread_count if participant else 0,
                is_muted=participant.is_muted if participant else False,
                is_archived=participant.is_archived if participant else False,
                created_at=conv.created_at,
            )
        )
    return out


async def fetch_conversations(
    db: AsyncSession,
    viewer_id: str,
    *,
    limit: int = 30,
    cursor: Optional[str] = None,
    include_archived: bool = False,
) -> Tuple[List[Conversation], Dict[UUID, ConversationParticipant], Optional[str], bool]:
    """The inbox: most recently active threads first."""
    query = (
        select(Conversation, ConversationParticipant)
        .join(
            ConversationParticipant,
            ConversationParticipant.conversation_id == Conversation.id,
        )
        .where(ConversationParticipant.user_id == viewer_id)
    )
    if not include_archived:
        query = query.where(ConversationParticipant.is_archived.is_(False))

    # A thread with no messages yet sorts by when it was opened, so a freshly
    # created conversation does not fall to the bottom of the inbox.
    sort_key = func.coalesce(Conversation.last_message_at, Conversation.created_at)

    before = decode_time_cursor(cursor)
    if before is not None:
        query = query.where(sort_key < before)

    rows = (await db.execute(query.order_by(sort_key.desc()).limit(limit + 1))).all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    conversations = [row[0] for row in rows]
    participants = {row[0].id: row[1] for row in rows}

    next_cursor = None
    if has_more and conversations:
        last = conversations[-1]
        marker = last.last_message_at or last.created_at
        if marker is not None:
            next_cursor = encode_time_cursor(marker)

    return conversations, participants, next_cursor, has_more


# --------------------------------------------------------------------------
# Messages
# --------------------------------------------------------------------------

def build_message_output(message: Message, viewer_id: str) -> MessageOut:
    is_mine = message.sender_id == viewer_id
    attachment = None
    if message.attachment_url and not message.is_removed:
        attachment = AttachmentOut(
            url=message.attachment_url,
            name=message.attachment_name,
            content_type=message.attachment_type,
            size=message.attachment_size,
        )

    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        body=None if message.is_removed else message.body,
        attachment=attachment,
        is_mine=is_mine,
        is_removed=message.is_removed,
        can_delete=is_mine and not message.is_removed,
        created_at=message.created_at,
        edited_at=message.edited_at,
    )


async def fetch_messages(
    db: AsyncSession,
    conversation_id: UUID,
    *,
    limit: int = 40,
    cursor: Optional[str] = None,
) -> Tuple[List[Message], Optional[str], bool]:
    """One page of a thread.

    Reads newest-first so "load older" is a cheap indexed walk backwards, then
    reverses for display. Removed messages are still returned so the tombstone
    keeps the conversation's shape.
    """
    query = select(Message).where(Message.conversation_id == conversation_id)

    before = decode_time_cursor(cursor)
    if before is not None:
        query = query.where(Message.created_at < before)

    rows = list(
        (
            await db.execute(
                query.order_by(Message.created_at.desc(), Message.id.desc()).limit(
                    limit + 1
                )
            )
        ).scalars()
    )

    has_more = len(rows) > limit
    rows = rows[:limit]

    next_cursor = None
    if has_more and rows and rows[-1].created_at is not None:
        next_cursor = encode_time_cursor(rows[-1].created_at)

    rows.reverse()
    return rows, next_cursor, has_more


def preview_for(message: Message) -> str:
    if message.body:
        flat = " ".join(message.body.split())
        return flat[:PREVIEW_LENGTH]
    if message.attachment_name:
        return f"📎 {message.attachment_name}"[:PREVIEW_LENGTH]
    return "📎 Attachment"


async def touch_conversation(db: AsyncSession, conversation: Conversation) -> None:
    """Refresh the inbox preview from the thread's newest surviving message."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()

    if latest is None:
        conversation.last_message_at = None
        conversation.last_message_preview = None
        conversation.last_message_sender_id = None
        return

    conversation.last_message_at = latest.created_at
    conversation.last_message_sender_id = latest.sender_id
    conversation.last_message_preview = (
        "This message was removed" if latest.is_removed else preview_for(latest)
    )


# --------------------------------------------------------------------------
# Unread
# --------------------------------------------------------------------------

async def recount_unread(
    db: AsyncSession, participant: ConversationParticipant
) -> int:
    """Derive this participant's unread count from the authoritative rows."""
    query = select(func.count(Message.id)).where(
        Message.conversation_id == participant.conversation_id,
        Message.sender_id != participant.user_id,
        Message.is_removed.is_(False),
    )
    if participant.last_read_at is not None:
        query = query.where(Message.created_at > participant.last_read_at)

    count = (await db.execute(query)).scalar_one()
    participant.unread_count = int(count)
    return participant.unread_count


async def recount_conversation(db: AsyncSession, conversation_id: UUID) -> None:
    """Recount every side of a thread after a change that affects both."""
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id
        )
    )
    for participant in result.scalars():
        await recount_unread(db, participant)


async def total_unread(db: AsyncSession, viewer_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(ConversationParticipant.unread_count), 0)).where(
            ConversationParticipant.user_id == viewer_id,
            ConversationParticipant.is_archived.is_(False),
        )
    )
    return int(result.scalar_one() or 0)


async def unread_conversation_count(db: AsyncSession, viewer_id: str) -> int:
    result = await db.execute(
        select(func.count(ConversationParticipant.id)).where(
            ConversationParticipant.user_id == viewer_id,
            ConversationParticipant.unread_count > 0,
            ConversationParticipant.is_archived.is_(False),
        )
    )
    return int(result.scalar_one() or 0)


# --------------------------------------------------------------------------
# Sync
# --------------------------------------------------------------------------

async def messages_since(
    db: AsyncSession, viewer_id: str, since: Optional[datetime], *, limit: int = 200
) -> List[Message]:
    """Every message in the viewer's threads newer than their cursor.

    Bounded by ``limit`` so a client returning after a long absence gets a
    truncated batch rather than an unbounded one; the inbox rows in the same
    response still convey the true unread totals.
    """
    if since is None:
        return []

    subquery = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == viewer_id
    )

    result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id.in_(subquery),
            Message.created_at > since,
        )
        .order_by(Message.created_at.asc(), Message.id.asc())
        .limit(limit)
    )
    return list(result.scalars())
