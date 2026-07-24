from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.report import StudentReportCreate, FacultyReportCreate, ReportResponse
from app.crud.report import create_report
from app.models.user import User
from app.models.role import UserRole, Role
from sqlalchemy.future import select
from jose import jwt, JWTError
from app.config import settings
from fastapi.security import OAuth2PasswordBearer
from uuid import UUID

router = APIRouter(prefix="/reports", tags=["reports"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

async def get_role_key(user: User, db: AsyncSession):
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == user.id)
    )
    roles = result.scalars().all()
    # Assuming single role for simplicity in check, but list handling is safer
    return [r.role_key for r in roles]

async def check_target_user_role(target_id: str, required_role_key: str, db: AsyncSession):
    # Verify the target user exists and has the required role
    result = await db.execute(
        select(User).join(UserRole).join(Role).where(
            User.id == target_id,
            Role.role_key == required_role_key
        )
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail=f"Target user does not have role {required_role_key} or does not exist")
    return user

@router.post("/student", response_model=ReportResponse)
async def create_student_report(
    report_data: StudentReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify Current User is STUDENT
    roles = await get_role_key(current_user, db)
    if "STUDENT" not in roles:
        raise HTTPException(status_code=403, detail="Only Students can submit this report")

    # 2. Verify Target is FACULTY
    await check_target_user_role(report_data.faculty_id, "FACULTY", db)
    
    # 3. Create Report
    try:
        new_report = await create_report(
            db,
            title=report_data.title,
            content=report_data.content,
            project_id=report_data.project_id,
            submitted_by=current_user.id,
            submitted_to=report_data.faculty_id
        )
        return new_report
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/faculty", response_model=ReportResponse)
async def create_faculty_report(
    report_data: FacultyReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify Current User is FACULTY
    roles = await get_role_key(current_user, db)
    if "FACULTY" not in roles:
        raise HTTPException(status_code=403, detail="Only Faculty can submit this report")

    # 2. Verify Target is PROJECT_HEAD
    await check_target_user_role(report_data.project_head_id, "PROJECT_HEAD", db)
    
    # 3. Create Report
    try:
        new_report = await create_report(
            db,
            title=report_data.title,
            content=report_data.content,
            project_id=report_data.project_id,
            submitted_by=current_user.id,
            submitted_to=report_data.project_head_id
        )
        return new_report
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")
