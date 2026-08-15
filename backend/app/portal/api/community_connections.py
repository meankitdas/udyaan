"""Connections (mutual, mentor-gated) and follows (one-way, instant)."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.crud import community as crud
from app.portal.crud import notification as notification_crud
from app.portal.models.notification import NotificationKind
from app.portal.database import get_db
from app.portal.models.community import Connection, ConnectionStatus, Follow
from app.portal.models.user import User
from app.portal.schemas.community import (
    ConnectionActionResult,
    ConnectionCreate,
    ConnectionOut,
    ConnectionRequests,
    ProfileSummary,
)

router = APIRouter(prefix="/community", tags=["community-connections"])


async def _load_target(db: AsyncSession, user_id: str, viewer_id: str) -> User:
    if user_id == viewer_id:
        raise HTTPException(status_code=400, detail="You cannot connect with yourself.")
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user or user.is_active is False:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _existing_between(db: AsyncSession, a: str, b: str) -> Optional[Connection]:
    """Find a connection in either direction.

    The unique constraint only covers the literal (requester, addressee) pair, so
    A->B and B->A can both be inserted at the database level. This is what stops
    the same relationship existing twice in opposite directions.
    """
    return (
        await db.execute(
            select(Connection).where(
                or_(
                    (Connection.requester_id == a) & (Connection.addressee_id == b),
                    (Connection.requester_id == b) & (Connection.addressee_id == a),
                )
            )
        )
    ).scalars().first()


async def _to_out(db: AsyncSession, connections: List[Connection], viewer_id: str) -> List[ConnectionOut]:
    """Render connections from the viewer's perspective (the *other* person)."""
    if not connections:
        return []

    other_ids = [
        c.addressee_id if c.requester_id == viewer_id else c.requester_id for c in connections
    ]
    users = (await db.execute(select(User).where(User.id.in_(other_ids)))).scalars().all()
    summaries = await crud.build_summaries(db, users, viewer_id)
    by_id = {s.id: s for s in summaries}

    out: List[ConnectionOut] = []
    for conn in connections:
        outgoing = conn.requester_id == viewer_id
        other_id = conn.addressee_id if outgoing else conn.requester_id
        person = by_id.get(other_id)
        if not person:  # user deactivated between the two queries
            continue
        out.append(
            ConnectionOut(
                id=conn.id,
                status=conn.status,
                message=conn.message,
                created_at=conn.created_at,
                responded_at=conn.responded_at,
                person=person,
                is_outgoing=outgoing,
            )
        )
    return out


@router.post("/connections", response_model=ConnectionActionResult)
async def request_connection(
    payload: ConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request a connection.

    Mentors vet who they take on, so a request addressed to a mentor stays
    `pending` until they accept. Student-to-student is symmetric and low-stakes,
    so it is accepted immediately — the approval step would only add friction.
    """
    target = await _load_target(db, payload.addressee_id, current_user.id)

    existing = await _existing_between(db, current_user.id, target.id)
    if existing:
        if existing.status == ConnectionStatus.ACCEPTED.value:
            raise HTTPException(status_code=409, detail="You are already connected.")
        if existing.status == ConnectionStatus.PENDING.value:
            if existing.addressee_id == current_user.id:
                # They asked first — treat this as accepting rather than
                # creating a second, conflicting request.
                return await _accept(db, existing)
            raise HTTPException(status_code=409, detail="Request already pending.")

        # A previously declined request can be retried; reuse the row so the
        # unique constraint is not violated.
        existing.requester_id = current_user.id
        existing.addressee_id = target.id
        existing.message = payload.message
        existing.responded_at = None
        connection = existing
    else:
        connection = Connection(
            requester_id=current_user.id,
            addressee_id=target.id,
            message=payload.message,
        )
        db.add(connection)

    role_keys = await crud.get_role_keys(db, [target.id])
    needs_approval = crud.is_mentor(role_keys.get(target.id))

    if needs_approval:
        connection.status = ConnectionStatus.PENDING.value
        connection.responded_at = None
        message = f"Request sent to {target.full_name}. They'll be notified to review it."
        await notification_crud.enqueue(
            db,
            user_id=target.id,
            kind=NotificationKind.CONNECTION_REQUEST,
            actor_id=current_user.id,
            target_id=str(connection.id) if connection.id else current_user.id,
        )
    else:
        connection.status = ConnectionStatus.ACCEPTED.value
        connection.responded_at = datetime.utcnow()
        message = f"You're now connected with {target.full_name}."

    await db.commit()
    await db.refresh(connection)

    return ConnectionActionResult(
        id=connection.id,
        status=connection.status,
        auto_accepted=not needs_approval,
        message=message,
    )


async def _accept(db: AsyncSession, connection: Connection) -> ConnectionActionResult:
    connection.status = ConnectionStatus.ACCEPTED.value
    connection.responded_at = datetime.utcnow()
    await db.commit()
    await db.refresh(connection)
    return ConnectionActionResult(
        id=connection.id,
        status=connection.status,
        auto_accepted=False,
        message="Connection accepted.",
    )


async def _load_pending_for_addressee(
    db: AsyncSession, connection_id: UUID, user_id: str
) -> Connection:
    connection = (
        await db.execute(
            select(Connection).where(
                Connection.id == connection_id,
                # Only the addressee may respond; scoping it in the query means a
                # requester trying to self-approve gets a 404, not a 403 leak.
                Connection.addressee_id == user_id,
                Connection.status == ConnectionStatus.PENDING.value,
            )
        )
    ).scalars().first()
    if not connection:
        raise HTTPException(status_code=404, detail="Pending request not found")
    return connection


@router.post("/connections/{connection_id}/accept", response_model=ConnectionActionResult)
async def accept_connection(
    connection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = await _load_pending_for_addressee(db, connection_id, current_user.id)
    return await _accept(db, connection)


@router.post("/connections/{connection_id}/decline", response_model=ConnectionActionResult)
async def decline_connection(
    connection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection = await _load_pending_for_addressee(db, connection_id, current_user.id)
    connection.status = ConnectionStatus.DECLINED.value
    connection.responded_at = datetime.utcnow()
    await db.commit()
    return ConnectionActionResult(
        id=connection.id, status=connection.status, message="Request declined."
    )


@router.delete("/connections/{connection_id}", status_code=204)
async def remove_connection(
    connection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect, or withdraw a request you sent. Either party may do this."""
    connection = (
        await db.execute(
            select(Connection).where(
                Connection.id == connection_id,
                or_(
                    Connection.requester_id == current_user.id,
                    Connection.addressee_id == current_user.id,
                ),
            )
        )
    ).scalars().first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    await db.delete(connection)
    await db.commit()
    return Response(status_code=204)


@router.get("/connections", response_model=List[ConnectionOut])
async def list_connections(
    status: str = Query(default="accepted", description="accepted | pending | all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Connection).where(
        or_(
            Connection.requester_id == current_user.id,
            Connection.addressee_id == current_user.id,
        )
    )
    if status != "all":
        query = query.where(Connection.status == status)

    connections = (
        await db.execute(query.order_by(Connection.created_at.desc()))
    ).scalars().all()
    return await _to_out(db, list(connections), current_user.id)


@router.get("/connections/requests", response_model=ConnectionRequests)
async def list_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The mentor inbox: requests awaiting my decision, plus my own in flight."""
    pending = (
        await db.execute(
            select(Connection)
            .where(
                Connection.status == ConnectionStatus.PENDING.value,
                or_(
                    Connection.addressee_id == current_user.id,
                    Connection.requester_id == current_user.id,
                ),
            )
            .order_by(Connection.created_at.desc())
        )
    ).scalars().all()

    rendered = await _to_out(db, list(pending), current_user.id)
    return ConnectionRequests(
        incoming=[c for c in rendered if not c.is_outgoing],
        outgoing=[c for c in rendered if c.is_outgoing],
    )


# --------------------------------------------------------------------------
# Follows
# --------------------------------------------------------------------------

@router.post("/follows/{user_id}", status_code=201)
async def follow_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _load_target(db, user_id, current_user.id)

    existing = (
        await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id, Follow.following_id == target.id
            )
        )
    ).scalars().first()
    if existing:
        return {"following": True}

    db.add(Follow(follower_id=current_user.id, following_id=target.id))
    await db.commit()
    return {"following": True}


@router.delete("/follows/{user_id}")
async def unfollow_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id, Follow.following_id == user_id
            )
        )
    ).scalars().first()
    if existing:
        await db.delete(existing)
        await db.commit()
    return {"following": False}


@router.get("/profiles/{user_id}/followers", response_model=List[ProfileSummary])
async def list_followers(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = (
        await db.execute(select(Follow.follower_id).where(Follow.following_id == user_id))
    ).scalars().all()
    return await _summaries_for(db, list(ids), current_user.id)


@router.get("/profiles/{user_id}/following", response_model=List[ProfileSummary])
async def list_following(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = (
        await db.execute(select(Follow.following_id).where(Follow.follower_id == user_id))
    ).scalars().all()
    return await _summaries_for(db, list(ids), current_user.id)


async def _summaries_for(
    db: AsyncSession, user_ids: List[str], viewer_id: str
) -> List[ProfileSummary]:
    if not user_ids:
        return []
    users = (
        await db.execute(
            select(User).where(User.id.in_(user_ids), User.is_active == True)  # noqa: E712
        )
    ).scalars().all()
    return await crud.build_summaries(db, users, viewer_id)
