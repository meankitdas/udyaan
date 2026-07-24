import redis.asyncio as redis
from app.config import settings

# Initialize Redis client
# decode_responses=True ensures we get strings back, not bytes
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get_redis():
    """Dependency to get Redis client"""
    return redis_client
