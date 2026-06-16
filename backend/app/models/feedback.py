import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=False)
    question_index = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    dimensions = Column(JSON, default=dict)
    overall_score = Column(Float, default=0.0)
    ai_feedback = Column(Text, default="")
    improvement_tips = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="feedbacks")