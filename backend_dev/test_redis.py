import asyncio
import redis.asyncio as redis
import os
from dotenv import load_dotenv

# Load env from backend_dev
load_dotenv('d:/workspaces/udyaan/backend_dev/.env')

REDIS_URL = os.getenv("REDIS_URL")

async def test_redis():
    print(f"Attempting to connect to Redis at {REDIS_URL}...")
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True)
        await client.set("test_key", "hello")
        val = await client.get("test_key")
        print(f"SUCCESS: Redis connected! Got value: {val}")
        await client.close()
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_redis())
