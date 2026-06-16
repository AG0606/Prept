import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, JSON, Integer
from sqlalchemy.orm import relationship
from ..core.database import Base

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    raw_text = Column(Text, nullable=False)
    skills = Column(JSON, default=list)
    experience = Column(JSON, default=list)
    education = Column(JSON, default=list)
    years_total = Column(Integer, default=0)
    target_roles = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="resume")