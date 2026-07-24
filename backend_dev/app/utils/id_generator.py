import random
import string
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

def generate_project_id():
    """
    Format: PRDDHHMMSSMMYY (14 chars)
    PR + Day + Hour + Min + Sec + Month + Year (2 digits)
    Example: PR152345100126
    """
    now = datetime.now()
    # Format: PR + %d%H%M%S%m%y
    # Note: %y is 2-digit year.
    # Total length: 2 (PR) + 2(d) + 2(H) + 2(M) + 2(S) + 2(m) + 2(y) = 14 chars
    return f"PR{now.strftime('%d%H%M%S%m%y')}"

async def generate_org_id(db: AsyncSession):
    """
    Format: ORGMMDDYY001 (12 chars)
    ORG + Month + Day + Year + Sequence (3 digits)
    """
    now = datetime.now()
    date_part = now.strftime('%m%d%y') # e.g. 011526
    prefix = f"ORG{date_part}"
    
    # Check for existing IDs with this prefix to determine sequence
    # This is a bit expensive but ensures uniqueness for the pattern.
    # Better approach might be a dedicated sequence table, but query count is safer here.
    query = text(f"SELECT id FROM organizations WHERE id LIKE '{prefix}%' ORDER BY id DESC LIMIT 1")
    result = await db.execute(query)
    last_id = result.scalars().first()
    
    if last_id:
        # Extract last 3 digits
        try:
            last_seq = int(last_id[-3:])
            new_seq = last_seq + 1
        except ValueError:
             new_seq = 1
    else:
        new_seq = 1
        
    return f"{prefix}{str(new_seq).zfill(3)}"

def generate_user_id(role_key: str):
    """
    Format:
    Student: ST + 8 chars
    Faculty: FA + 8 chars
    Project Head: PH + 8 chars
    Admin: AD + 8 chars
    Superadmin: SA + 8 chars
    Others: US + 8 chars
    Total: 10 chars
    """
    if role_key == "STUDENT":
        prefix = "ST"
    elif role_key == "FACULTY":
        prefix = "FA"
    elif role_key == "PROJECT_HEAD":
        prefix = "PH"
    elif role_key == "ADMIN":
        prefix = "AD"
    elif role_key == "SUPERADMIN":
        prefix = "SA"
    else:
        prefix = "US"
        
    return f"{prefix}{generate_random_string(8)}"
