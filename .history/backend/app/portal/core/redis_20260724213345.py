import redis.asyncio as redis
from app.portal.config import settings

# Lazily create the Redis client so the merged app can boot without REDIS_URL.
_redis_client = None


def _get_client():
    global _redis_client
    if _redis_client is None:
        if not settings.REDIS_URL:
            raise RuntimeError("REDIS_URL is not configured")
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def get_redis():
    """Dependency to get Redis client"""
    return _get_client()
