from app.config import settings
from app.core.security import get_password_hash

print(f"Password: '{settings.SUPERADMIN_PASSWORD}'")
print(f"Length: {len(settings.SUPERADMIN_PASSWORD)}")

try:
    hash = get_password_hash(settings.SUPERADMIN_PASSWORD)
    print(f"Hash: {hash}")
except Exception as e:
    print(f"Error: {e}")
