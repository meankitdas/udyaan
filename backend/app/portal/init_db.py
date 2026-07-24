import asyncio
import app.portal.database as portal_db
from dotenv import load_dotenv

load_dotenv()


async def init_db():
    await portal_db.init_models()
    print("Database initialised successfully.")
    await portal_db.engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
