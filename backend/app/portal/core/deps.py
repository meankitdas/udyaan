"""Shared authentication dependencies for the portal API.

Previously every router defined its own ``get_current_user``. Those copies drifted
apart and none of them validated the token *type*, which meant a refresh token was
accepted as an access token. This module is now the single source of truth.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.config import settings
from app.portal.database import get_db
from app.portal.models.user import User

# Routers are mounted under /portal, so the docs' token URL must include it.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="portal/auth/login")


def unauthorized(detail: str, code: str) -> HTTPException:
    """401 with a machine-readable reason so clients can react correctly.

    ``X-Auth-Error: token_expired`` tells the frontend to silently refresh,
    whereas ``token_invalid`` means the session is unrecoverable.
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer", "X-Auth-Error": code},
    )


def decode_token(token: str, expected_type: str = "access") -> dict:
    """Decode and validate a JWT, enforcing its expected ``type`` claim."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError:
        raise unauthorized(
            "Your session has expired. Please sign in again."
            if expected_type == "refresh"
            else "Access token expired",
            "token_expired",
        )
    except JWTError:
        raise unauthorized("Could not validate credentials", "token_invalid")

    if expected_type and payload.get("type") != expected_type:
        raise unauthorized("Invalid token type", "token_invalid")

    return payload


async def user_from_access_token(token: str, db: AsyncSession) -> User:
    """Resolve an access token to an active user.

    Split out of :func:`get_current_user` so callers that accept more than one
    kind of credential can reuse the exact same validation instead of
    reimplementing it and drifting, which is the failure this module exists to
    prevent.
    """
    payload = decode_token(token, "access")

    email = payload.get("sub")
    if not email:
        raise unauthorized("Could not validate credentials", "token_invalid")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user is None:
        raise unauthorized("Could not validate credentials", "token_invalid")

    if user.is_active is False:
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await user_from_access_token(token, db)
