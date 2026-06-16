import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Enum, JSON, ForeignKey, Integer
from sqlalchemy.orm import relationship
from ..core.database import Base
import enum

class SessionType(str, enum.Enum):
    behavioral = "behavioral"
    technical = "technical"
    coding = "coding"
    system_design = "system_design"

class SessionStatus(str, enum.Enum):
    idle = "idle"
    in_progress = "in_progress"
    completed = "completed"

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_type = Column(Enum(SessionType), nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.idle)
    role = Column(String(100), nullable=False)
    seniority = Column(String(50), default="mid")
    company_focus = Column(String(100), default="")
    resume_id = Column(String(36), ForeignKey("resumes.id"), nullable=True)
    current_question_index = Column(Integer, default=0)
    questions = Column(JSON, default=list)
    transcript = Column(JSON, default=list)
    scores = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    resume = relationship("Resume", back_populates="sessions")
    feedbacks = relationship("Feedback", back_populates="session", cascade="all, delete-orphan")