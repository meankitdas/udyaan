from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report
from uuid import UUID

async def create_report(
    db: AsyncSession, 
    title: str, 
    content: str, 
    project_id: UUID, 
    submitted_by: UUID, 
    submitted_to: UUID
):
    db_report = Report(
        title=title,
        content=content,
        project_id=project_id,
        submitted_by=submitted_by,
        submitted_to=submitted_to
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report
