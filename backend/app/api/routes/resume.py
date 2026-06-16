from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...services.resume_parser import ResumeParser

router = APIRouter(prefix="/api/resume", tags=["resume"])

@router.post("/upload")
async def upload_resume(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    parser = ResumeParser(db)
    result = await parser.parse_and_store(file)
    return result

@router.get("/{resume_id}")
async def get_resume(resume_id: str, db: AsyncSession = Depends(get_db)):
    parser = ResumeParser(db)
    result = await parser.get(resume_id)
    if not result:
        raise HTTPException(404, "Resume not found")
    return result

@router.get("/{resume_id}/questions")
async def get_personalized_questions(
    resume_id: str,
    role: str = "",
    db: AsyncSession = Depends(get_db),
):
    parser = ResumeParser(db)
    questions = await parser.generate_questions(resume_id, role)
    return {"questions": questions}