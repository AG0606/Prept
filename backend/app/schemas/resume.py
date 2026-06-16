from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ResumeResponse(BaseModel):
    id: str
    filename: str
    skills: List[str]
    experience: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    years_total: int
    target_roles: List[str]