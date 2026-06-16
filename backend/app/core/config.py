from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/interview_coach.db"
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    groq_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    groq_model: str = "llama-3.1-70b-versatile"
    judge0_url: str = "http://judge0:2358"
    tts_enabled: bool = True
    stt_enabled: bool = True
    cors_origins: List[str] = ["http://localhost:3000"]
    max_questions_per_session: int = 10
    session_timeout_minutes: int = 120

    class Config:
        env_file = ".env"

settings = Settings()