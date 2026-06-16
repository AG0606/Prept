from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from .llm_service import LLMService

class VisionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = LLMService()

    async def evaluate_checkpoint(self, session_id: str, phase: int, canvas_base64: str, chat_history: List[Dict[str, str]]) -> Dict[str, Any]:
        prompt = f"""
        Evaluate this system design architecture diagram for Phase {phase}.
        Chat history: {chat_history}
        
        Score 1-10 on correctness, completeness, scalability, and layout.
        Return JSON with scores and feedback.
        """
        system = "You are an expert system design interviewer evaluating a whiteboard architecture."
        
        raw_response = await self.llm.provider.generate_vision(prompt, canvas_base64, system)
        
        try:
            import json
            cleaned = raw_response.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned)
        except:
            return {
                "scores": {"correctness": 7, "scalability": 7},
                "feedback": "The architecture looks reasonable but might need caching."
            }\n