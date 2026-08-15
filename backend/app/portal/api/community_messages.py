"""Direct messaging: conversations, threads, read state, and change sync.

Endpoint shapes deliberately mirror the feed router so the frontend contract
stays uniform: cursor pagination everywhere, 404 rather than 403 for anything
the caller is not a participant in, and attachments reusing the Phase 2 signed
upload path.

The one endpoint worth calling out is ``/messages/sync``. It is the transport
seam: today the client polls it on an adaptive interval, but its payload is
already shaped as a change set (new messages, touched conversations, unread
total) rather than a snapshot. Swapping in SSE or WebSockets later means
delivering the same payload over a different pipe, with no schema change and no
change to the client's reducer.
"""

import json
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.core import presence
from app.portal.core import crypto
from app.portal.core.deps import get_current_user
from app.portal.crud import notification as notification_crud
from app.portal.models.notification import NotificationKind
from app.portal.crud import community_message as crud
from app.portal.database import get_db
from app.portal.models.community_message import Conversation, Message
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community_message import (
    ConversationCreate,
    ConversationOut,
    ConversationPage,
    MessageCreate,
    MessageOut,
    MessagePage,
    ReadReceipt,
    ReadResult,
    SyncResponse,
    UnreadSummary,
)
from app.portal.utils import storage

router = APIRouter(prefix="/community", tags=["community-messages"])

ADMIN_ROLE_KEYS = ("OWNER", "ADMIN", "SUPERADMIN")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

async def _is_moderator(db: AsyncSession, user_id: str) -> bool:
    role_keys = (
        await db.execute(
            select(Role.role_key)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
    ).scalars().all()
    return bool(set(role_keys) & set(ADMIN_ROLE_KEYS))


async def _load_conversation(
    db: AsyncSession, conversation_id: UUID, viewer_id: str
) -> Conversation:
    """Load a thread the caller actually belongs to.

    Membership is proven via the participant row rather than checked after the
    fact, so a non-participant gets an identical 404 to a nonexistent id and
    cannot probe for the existence of other people's conversations.
    """
    participant = await crud.get_participant(db, conversation_id, viewer_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalars().first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _validate_attachment(attachment) -> None:
    """Reject an attachment URL that did not come from our own bucket."""
    if attachment is None:
        return
    if not storage.is_managed_attachment(attachment.url):
        raise HTTPException(
            status_code=400,
            detail="Attachments must be uploaded through the community uploader.",
        )


async def _conversation_output(
    db: AsyncSession, conversation: Conversation, viewer_id: str
) -> ConversationOut:
    participant = await crud.get_participant(db, conversation.id, viewer_id)
    outputs = await crud.build_conversation_outputs(
        db,
        [conversation],
        {conversation.id: participant} if participant else {},
        viewer_id,
    )
    return outputs[0]


# --------------------------------------------------------------------------
# Conversations
# --------------------------------------------------------------------------

@router.get("/conversations", response_model=ConversationPage)
async def list_conversations(
    limit: int = Query(30, ge=1, le=50),
    cursor: Optional[str] = None,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations, participants, next_cursor, has_more = await crud.fetch_conversations(
        db,
        current_user.id,
        limit=limit,
        cursor=cursor,
        include_archived=include_archived,
    )
    items = await crud.build_conversation_outputs(
        db, conversations, participants, current_user.id
    )
    return ConversationPage(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
        total_unread=await crud.total_unread(db, current_user.id),
    )


@router.post("/conversations", response_model=ConversationOut)
async def open_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get-or-create the thread with another member.

    Idempotent: tapping "Message" repeatedly returns the same conversation
    rather than accumulating empty threads.
    """
    other = (
        await db.execute(select(User).where(User.id == payload.user_id))
    ).scalars().first()
    if other is None:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        conversation = await crud.get_or_create_conversation(
            db, current_user.id, other.id
        )
    except crud.NotConnected as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    await db.commit()
    await db.refresh(conversation)
    return await _conversation_output(db, conversation, current_user.id)


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await _load_conversation(db, conversation_id, current_user.id)
    return await _conversation_output(db, conversation, current_user.id)


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: UUID,
    is_muted: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-user mute/archive. Only ever touches the caller's own participant row."""
    conversation = await _load_conversation(db, conversation_id, current_user.id)
    participant = await crud.get_participant(db, conversation_id, current_user.id)

    if is_muted is not None:
        participant.is_muted = is_muted
    if is_archived is not None:
        participant.is_archived = is_archived

    await db.commit()
    await db.refresh(conversation)
    return await _conversation_output(db, conversation, current_user.id)


# --------------------------------------------------------------------------
# Messages
# --------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: UUID,
    limit: int = Query(40, ge=1, le=100),
    cursor: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_conversation(db, conversation_id, current_user.id)
    messages, next_cursor, has_more = await crud.fetch_messages(
        db, conversation_id, limit=limit, cursor=cursor
    )
    return MessagePage(
        items=[crud.build_message_output(m, current_user.id) for m in messages],
        next_cursor=next_cursor,
        has_more=has_more,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await _load_conversation(db, conversation_id, current_user.id)
    _validate_attachment(payload.attachment)

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        body=crypto.encrypt_text(payload.body.strip()) if payload.body else None,
        created_at=crud.utcnow(),
    )
    if payload.attachment:
        message.attachment_url = payload.attachment.url
        message.attachment_name = payload.attachment.name
        message.attachment_type = payload.attachment.content_type
        message.attachment_size = payload.attachment.size

    db.add(message)
    await db.flush()

    await crud.touch_conversation(db, conversation)

    # The sender has by definition read their own message, so advance their
    # cursor too; otherwise their own send would leave the thread looking unread.
    sender_participant = await crud.get_participant(db, conversation.id, current_user.id)
    if sender_participant is not None:
        sender_participant.last_read_at = message.created_at

    await crud.recount_conversation(db, conversation.id)
    await db.commit()
    await db.refresh(message)

    output = crud.build_message_output(message, current_user.id)

    # Push to the recipient's live sockets. Best-effort: the sync endpoint is
    # still the source of truth, so a dropped push only costs latency.
    other_ids = await crud.get_other_participant_ids(db, [conversation.id], current_user.id)
    other_id = other_ids.get(conversation.id)
    if other_id:
        await notification_crud.enqueue(
            db,
            user_id=other_id,
            kind=NotificationKind.MESSAGE,
            actor_id=current_user.id,
            target_id=str(conversation.id),
        )
        await db.commit()

        await presence.publish_event(
            other_id,
            json.dumps(
                {
                    "type": "message",
                    "conversation_id": str(conversation.id),
                    # Rendered for the recipient, not the sender: is_mine and
                    # can_delete are viewer-relative, so pushing the sender's
                    # copy makes their message appear as the recipient's own
                    # until the next sync corrects it.
                    "message": jsonable_encoder(
                        crud.build_message_output(message, other_id)
                    ),
                }
            ),
        )
        # A message means the sender stopped typing.
        await presence.publish_typing(str(conversation.id), current_user.id, False)

    return output


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a message. Sender or moderator only."""
    message = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalars().first()
    if message is None or message.is_removed:
        raise HTTPException(status_code=404, detail="Message not found")

    participant = await crud.get_participant(
        db, message.conversation_id, current_user.id
    )
    is_mod = await _is_moderator(db, current_user.id)
    if participant is None and not is_mod:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != current_user.id and not is_mod:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")

    message.is_removed = True
    message.removed_at = crud.utcnow()
    message.removed_by = current_user.id

    conversation = (
        await db.execute(
            select(Conversation).where(Conversation.id == message.conversation_id)
        )
    ).scalars().first()
    if conversation is not None:
        await crud.touch_conversation(db, conversation)
        await crud.recount_conversation(db, conversation.id)

    await db.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------
# Read state
# --------------------------------------------------------------------------

@router.post("/conversations/{conversation_id}/read", response_model=ReadResult)
async def mark_read(
    conversation_id: UUID,
    payload: ReadReceipt,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_conversation(db, conversation_id, current_user.id)
    participant = await crud.get_participant(db, conversation_id, current_user.id)

    until = payload.until
    if until is not None and until.tzinfo is not None:
        until = until.replace(tzinfo=None)
    until = until or crud.utcnow()

    # Never rewind: a stale receipt arriving out of order would otherwise
    # resurrect messages the user has already seen.
    if participant.last_read_at is None or until > participant.last_read_at:
        participant.last_read_at = until

    await crud.recount_unread(db, participant)
    # Seeing the thread in-app cancels the queued digest line for it.
    await notification_crud.mark_seen(
        db,
        current_user.id,
        kind=NotificationKind.MESSAGE,
        target_id=str(conversation_id),
    )
    await db.commit()

    return ReadResult(
        conversation_id=conversation_id,
        unread_count=participant.unread_count,
        total_unread=await crud.total_unread(db, current_user.id),
    )


@router.get("/messages/unread", response_model=UnreadSummary)
async def unread_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cheap badge endpoint for the nav, when the full sync payload isn't needed."""
    return UnreadSummary(
        total_unread=await crud.total_unread(db, current_user.id),
        conversation_count=await crud.unread_conversation_count(db, current_user.id),
    )


# --------------------------------------------------------------------------
# Sync (transport seam)
# --------------------------------------------------------------------------

@router.get("/messages/sync", response_model=SyncResponse)
async def sync_messages(
    since: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Everything that changed since the caller's cursor.

    The cursor is captured *before* the reads below, not after, so a message
    committed while this request is being served is picked up by the next poll
    instead of falling into the gap between two cursors.
    """
    now = crud.utcnow()
    since_at = crud.decode_time_cursor(since)

    messages = await crud.messages_since(db, current_user.id, since_at)

    # Only the threads that actually moved, so a quiet inbox syncs in one row.
    conversations: List[ConversationOut] = []
    if messages:
        touched = {m.conversation_id for m in messages}
        rows = list(
            (
                await db.execute(
                    select(Conversation).where(Conversation.id.in_(list(touched)))
                )
            ).scalars()
        )
        participants = {}
        for conv in rows:
            participant = await crud.get_participant(db, conv.id, current_user.id)
            if participant is not None:
                participants[conv.id] = participant
        conversations = await crud.build_conversation_outputs(
            db, rows, participants, current_user.id
        )

    return SyncResponse(
        cursor=crud.encode_time_cursor(now),
        server_time=now,
        messages=[crud.build_message_output(m, current_user.id) for m in messages],
        conversations=conversations,
        total_unread=await crud.total_unread(db, current_user.id),
    )
