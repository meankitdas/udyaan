import asyncio
from sqlalchemy import text
from app.database import engine

async def inspect():
    async with engine.begin() as conn:
        print("Columns in organizations:")
        try:
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations'"))
            for row in res.fetchall():
                print(row[0])
        except Exception as e:
            print(e)

if __name__ == "__main__":
    asyncio.run(inspect())
