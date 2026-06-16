from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.database import init_db
from .core.config import settings
from .api.routes import sessions, resume, coding, system_design, analytics
from .api import websocket

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("Database initialized")
    yield

app = FastAPI(
    title="AI Interview Coach",
    description="AI-powered interview simulator with behavioral, technical, coding, and system design modes",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(resume.router)
app.include_router(coding.router)
app.include_router(system_design.router)
app.include_router(analytics.router)
app.include_router(websocket.router)

@app.get("/health")
async def health():
    return {"status": "ok", "llm_provider": settings.llm_provider}