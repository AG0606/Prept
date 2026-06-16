import fitz  # PyMuPDF
import docx
from typing import Dict, Any, List
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from .llm_service import LLMService
from ..models.resume import Resume

class ResumeParser:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = LLMService()

    async def parse_and_store(self, file: UploadFile) -> Dict[str, Any]:
        text = ""
        content = await file.read()
        
        if file.filename.endswith(".pdf"):
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                text += page.get_text()
        elif file.filename.endswith(".docx"):
            from io import BytesIO
            doc = docx.Document(BytesIO(content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            text = content.decode("utf-8", errors="ignore")

        parsed_data = await self.llm.parse_resume(text)
        
        resume = Resume(
            filename=file.filename,
            raw_text=text,
            skills=parsed_data.get("skills", []),
            experience=parsed_data.get("experience", []),
            education=parsed_data.get("education", []),
            years_total=parsed_data.get("years_total", 0),
            target_roles=parsed_data.get("target_roles", [])
        )
        self.db.add(resume)
        await self.db.commit()
        await self.db.refresh(resume)
        
        return {
            "id": resume.id,
            "filename": resume.filename,
            "parsed": parsed_data
        }

    async def get(self, resume_id: str) -> Dict[str, Any]:
        from sqlalchemy import select
        result = await self.db.execute(select(Resume).where(Resume.id == resume_id))
        resume = result.scalar_one_or_none()
        if not resume:
            return None
        return {
            "id": resume.id,
            "filename": resume.filename,
            "skills": resume.skills,
            "experience": resume.experience,
            "education": resume.education,
            "years_total": resume.years_total,
            "target_roles": resume.target_roles
        }

    async def generate_questions(self, resume_id: str, role: str) -> List[Dict[str, Any]]:
        from sqlalchemy import select
        result = await self.db.execute(select(Resume).where(Resume.id == resume_id))
        resume = result.scalar_one_or_none()
        if not resume:
            return []
            
        exp_summary = "\n".join([f"{e.get('title')} at {e.get('company')}" for e in resume.experience])
        return await self.llm.generate_personalized_questions(
            resume.skills, exp_summary, resume.years_total, role
        )\n