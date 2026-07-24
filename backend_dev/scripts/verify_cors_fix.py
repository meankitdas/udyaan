
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath("d:/workspaces/udyaan/backend"))

# Mock environment variables for config
os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost/db"
os.environ["SECRET_KEY"] = "test"
os.environ["MAIL_USERNAME"] = "test"
os.environ["MAIL_PASSWORD"] = "test"
os.environ["REDIS_URL"] = "redis://localhost"
# Set BACKEND_CORS_ORIGINS to a test value
os.environ["BACKEND_CORS_ORIGINS"] = '["http://test.com", "https://app.udyaan.org"]'

# Mock mangum
from unittest.mock import MagicMock
sys.modules["mangum"] = MagicMock()

try:
    from app.config import settings
    from app.main import app
    from fastapi.middleware.cors import CORSMiddleware
    
    print("Settings loaded successfully.")
    print(f"BACKEND_CORS_ORIGINS: {settings.BACKEND_CORS_ORIGINS}")
    
    cors_middleware = None
    for middleware in app.user_middleware:
        if middleware.cls == CORSMiddleware:
            cors_middleware = middleware
            break
            
    if cors_middleware:
        print("CORSMiddleware found.")
        # Note: middleware options are often hidden in closures or partials, 
        # but we can try to inspect or just trust the startup didn't crash.
        # In FastAPI/Starlette, allow_origins is passed to the middleware instance.
        # However, checking the loaded app object reflects the configuration.
        # The easiest check is confirming settings loaded the env var correctly and app imported successfully.
        
        # Verify allow_origins is correct in the settings at least
        expected = ["http://test.com", "https://app.udyaan.org"]
        if sorted([str(o) for o in settings.BACKEND_CORS_ORIGINS]) == sorted(expected):
            print("SUCCESS: CORS origins match configuration.")
        else:
            print(f"FAILURE: CORS origins mismatch. Got {settings.BACKEND_CORS_ORIGINS}")
            
    else:
        print("FAILURE: CORSMiddleware not found in app.")

except Exception as e:
    print(f"CRITICAL FAILURE: {e}")
    import traceback
    traceback.print_exc()
