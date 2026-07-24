"""Ad-hoc end-to-end check of the portal AI pipeline against the real database."""

import asyncio

from sqlalchemy import select

from app.portal.ai.agent import run_agent
from app.portal.ai.indexer import reindex_organization
from app.portal.ai.llm import get_llm
from app.portal.ai.retrieval import hybrid_search
from app.portal.database import _init_db_sync
from app.portal.models.user import User

ORG = "ORG020626001"


async def main() -> None:
    _init_db_sync()
    from app.portal.database import AsyncSessionLocal as Session

    llm = get_llm()
    print(f"LLM available: {llm.available} ({llm.model})")

    async with Session() as db:
        stats = await reindex_organization(db, ORG)
        print("INDEX:", stats)

        hits = await hybrid_search(db, "irrigation and water for farmers", ORG, "probe", k=3)
        print(f"RETRIEVAL: {len(hits)} hits")
        for h in hits:
            print(f"  - [{h['kind']}] {h['title']} rrf={h['score']} bm25={h['keyword_score']} vec={h['vector_score']}")

        user = (await db.execute(select(User).where(User.organization_id == ORG))).scalars().first()
        if not user:
            print("no user found")
            return
        print(f"AGENT as: {user.full_name}")

        for question in [
            "What projects exist in my organization and what are their deadlines?",
            "Who has skills that could help with a water or irrigation project?",
        ]:
            result = await run_agent(db, user, "ADMIN", question)
            print(f"\nQ: {question}")
            print(f"A: {result['answer'][:400]}")
            print(f"   tools used: {[t['tool'] for t in result['trace']]}")
            print(f"   citations: {[c['title'] for c in result['citations']][:4]}")


asyncio.run(main())
