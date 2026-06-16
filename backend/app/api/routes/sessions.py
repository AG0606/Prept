from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...schemas.session import CreateSessionRequest, AnswerRequest
from ...services.interview_engine import InterviewEngine

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.post("/")
async def create_session(req: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    result = await engine.create(
        session_type=req.session_type,
        role=req.role,
        seniority=req.seniority,
        company_focus=req.company_focus,
        resume_id=req.resume_id,
    )
    return result

@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    session = await engine.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session

@router.post("/{session_id}/start")
async def start_session(session_id: str, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    return await engine.start(session_id)

@router.post("/{session_id}/answer")
async def submit_answer(session_id: str, req: AnswerRequest, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    return await engine.process_answer(session_id, req.question_index, req.answer)

@router.post("/{session_id}/skip")
async def skip_question(session_id: str, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    return await engine.skip(session_id)

@router.get("/{session_id}/feedback")
async def get_feedback(session_id: str, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    return await engine.get_feedback(session_id)

@router.get("/{session_id}/report")
async def get_report(session_id: str, db: AsyncSession = Depends(get_db)):
    engine = InterviewEngine(db)
    return await engine.get_report(session_id)