import asyncio
import sys
from uuid import UUID
from app.database import AsyncSessionLocal
from app.crud.project import get_projects_with_details
from app.schemas.project import ProjectWithDetails

async def test_crud():
    async with AsyncSessionLocal() as db:
        print("--- TESTING CRUD ---")
        
        # Test Data from Debug Dump
        org_id = UUID("e07c1089-76bc-433f-95ee-5f3fc7b540f6")
        user_id = "083396fc-c2e7-4497-9a9b-677034ab352f"
        user_name = "AK"
        
        print(f"Fetching for Org: {org_id}, User ID: {user_id}, Name: {user_name}")
        
        try:
            projects = await get_projects_with_details(
                db, 
                org_id, 
                target_assignee_id=user_id,
                target_assignee_name=user_name
            )
            print(f"Found {len(projects)} projects.")
            
            for p in projects:
                print(f"Project: {p['title']}, Assignee: {p.get('assignee_name')}, Creator: {p.get('created_by_name')}")
                # Validate Schema
                try:
                    pd = ProjectWithDetails(**p)
                    print("  [Valid Pydantic Schema]")
                except Exception as e:
                    print(f"  [Schema Validation Failed]: {e}")
                    
        except Exception as e:
            print(f"[CRUD Error]: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_crud())
