from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..models.session import SessionType

class CreateSessionRequest(BaseModel):
    session_type: SessionType
    role: str
    seniority: str = "mid"
    company_focus: str = ""
    resume_id: Optional[str] = None

class AnswerRequest(BaseModel):
    answer: str
    question_index: int

class CodeRunRequest(BaseModel):
    source_code: str
    language: str = "python"
    stdin: str = ""

class CodeSubmitRequest(BaseModel):
    source_code: str
    language: str = "python"
    problem_id: str

class DesignCheckpointRequest(BaseModel):
    phase: int
    canvas_base64: str
    chat_history: List[Dict[str, str]] = []

class SessionResponse(BaseModel):
    id: str
    session_type: str
    status: str
    role: str
    seniority: str
    current_question_index: int
    transcript: List[Dict[str, Any]]
    scores: Dict[str, Any]