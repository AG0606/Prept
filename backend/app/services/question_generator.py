from typing import List, Dict, Any, Optional
import json
import os
from .llm_service import LLMService

class QuestionGenerator:
    def __init__(self):
        self.llm = LLMService()

    async def generate_questions(self, session_type: str, role: str, seniority: str, resume_id: Optional[str] = None) -> List[Dict[str, Any]]:
        questions = []
        
        if session_type == "coding":
            path = os.path.join("data", "problems", "arrays.json")
            if os.path.exists(path):
                with open(path, "r") as f:
                    data = json.load(f)
                    questions.extend(data[:3])
            else:
                questions = [{"title": "Two Sum", "description": "Find two numbers that add up to target.", "difficulty": "easy"}]
        
        elif session_type == "system_design":
            questions = [
                {"title": "Design URL Shortener", "phase": "Requirements"},
                {"title": "Design URL Shortener", "phase": "High Level Architecture"},
                {"title": "Design URL Shortener", "phase": "Deep Dive"}
            ]
        
        else: # behavioral or technical
            categories = ["leadership", "conflict resolution", "failure", "architecture", "scalability"]
            for cat in categories[:3]: 
                q = await self.llm.generate_question(session_type, role, seniority, "Tech Company", cat)
                questions.append({
                    "question": q,
                    "category": cat
                })
                
        return questions\n