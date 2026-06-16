from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...services.vision_service import VisionService
from ...schemas.session import DesignCheckpointRequest

router = APIRouter(prefix="/api/design", tags=["system_design"])

@router.post("/{session_id}/checkpoint")
async def submit_design_checkpoint(
    session_id: str,
    req: DesignCheckpointRequest,
    db: AsyncSession = Depends(get_db),
):
    service = VisionService(db)
    result = await service.evaluate_checkpoint(session_id, req.phase, req.canvas_base64, req.chat_history)
    return result

@router.get("/topics")
async def get_design_topics():
    topics = [
        {"id": "design-001", "title": "URL Shortener", "difficulty": "easy"},
        {"id": "design-002", "title": "Chat System (WhatsApp)", "difficulty": "medium"},
        {"id": "design-003", "title": "Twitter Feed", "difficulty": "medium"},
        {"id": "design-004", "title": "Uber / Ride Hailing", "difficulty": "hard"},
    ]
    return {"topics": topics}