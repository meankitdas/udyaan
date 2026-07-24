from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import logging
from dotenv import load_dotenv

# 1. Environment & Logging Setup
# 1. Environment & Logging Setup
load_dotenv()
from app.core.logging import setup_logging
logger = setup_logging()
# logging.basicConfig(level=logging.INFO) # Replaced by setup_logging
# logger = logging.getLogger(__name__)

# 2. Imports (Lazy internal imports where possible, but top-level for routers is standard)
from app.config import settings
from app.api import auth, organizations, project_heads, projects, reports, admin, project_compliance

# 3. App Initialization
app = FastAPI(
    title="Udyaan Backend",
    description="Production-ready FastAPI backend for AWS Lambda",
    version="1.0.0"
)

# 4. Global Exception Handler (Stateless & Crash-Safe)
# Must define this BEFORE other middleware to catch everything
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        # Log the full traceback for CloudWatch
        logger.error("Unhandled error", exc_info=True)
        
        # Return a valid JSON response even if the app crashes
        # Explicitly add CORS headers so the frontend doesn't see a network error
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal Server Error",
                "message": str(e)  # Consider hiding this in strict production
            },
            headers={
                # "Access-Control-Allow-Origin": "*",
                # "Access-Control-Allow-Methods": "*",
                # "Access-Control-Allow-Headers": "*"
            }
        )

# 5. Middleware Setup
# CORS Middleware (Handle OPTIONS requests & standard headers)
# Added after exception handler so it wraps the inner app logic? 
# In FastAPI/Starlette, 'add_middleware' adds to the OUTER layer.
# So Request -> CORSMiddleware -> ExceptionHandler -> App
# This ensures CORS middleware handles OPTIONS requests before they hit the app logic.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],   # Allows all HTTP methods
    allow_headers=["*"],   # Allows all headers
)

# 6. Routers
app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(project_heads.router)
app.include_router(projects.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(project_compliance.router)

# 7. Health Check
@app.get("/")
async def read_root():
    from app.database import get_db
    from sqlalchemy import text
    try:
        # Verify DB connection
        async for session in get_db():
            await session.execute(text("SELECT 1"))
            break
        return {"message": "Udyaan Backend API", "status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=503,
            content={"message": "Udyaan Backend API", "status": "unhealthy", "detail": str(e)}
        )

# 8. Lambda Handler
# lifespan="off" prevents waiting for startup/shutdown events, crucial for Lambda performance & stability
handler = Mangum(app, lifespan="off")
