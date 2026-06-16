import json
from typing import Optional, Dict, Any, List
from ..core.config import settings
from ..core.llm_provider import LLMProvider
from ..core.gemini_provider import GeminiProvider
from ..core.groq_provider import GroqProvider

PROMPT_TEMPLATES = {
    "generate_behavioral": """Generate a behavioral interview question for a {role} position at {company} (seniority: {seniority}).
Focus on: {category}.
The question should test the candidate's ability to articulate experiences using the STAR framework.
Return ONLY the question text, no explanation.""",

    "generate_technical": """Generate a technical interview question for a {role} at {company} (seniority: {seniority}).
Topic: {category}.
The question should test deep understanding of concepts, not just memorization.
Return ONLY the question text, no explanation.""",

    "evaluate_behavioral": """Evaluate this behavioral interview answer.

Context: {role} position at {company} (seniority: {seniority})
Question: {question}
Answer: {answer}

Score 1-10 on these dimensions:
- relevance: How relevant is the answer to the question?
- structure: Did they use the STAR format (Situation, Task, Action, Result)?
- clarity: Is the answer clear and well-organized?
- depth: Did they provide sufficient detail and show impact?
- communication: Is the delivery confident and professional?

Return ONLY valid JSON (no other text):
{{"scores": {{"relevance": int, "structure": int, "clarity": int, "depth": int, "communication": int}}, "feedback": "2-3 sentence constructive feedback", "improvement_tips": "1-2 specific tips for improvement", "follow_up": "A follow-up question to probe deeper"}}""",

    "evaluate_technical": """Evaluate this technical interview answer.

Role: {role}
Question: {question}
Answer: {answer}

Score 1-10 on:
- correctness: Is the answer technically accurate?
- depth: Does it show deep understanding?
- clarity: Is it clearly explained?
- communication: Is it well-articulated?
- completeness: Does it cover all important aspects?

Return ONLY valid JSON:
{{"scores": {{"correctness": int, "depth": int, "clarity": int, "communication": int, "completeness": int}}, "feedback": "str", "improvement_tips": "str", "follow_up": "str"}}""",

    "evaluate_coding": """Evaluate this coding solution.

Problem: {question}
Solution code:
{answer}

Score 1-10 on:
- correctness: Does the algorithm correctly solve the problem?
- code_quality: Is the code clean, readable, well-structured?
- approach: Is the algorithmic approach optimal?
- efficiency: Time & space complexity analysis?
- communication: Did they explain their approach well?

Return ONLY valid JSON:
{{"scores": {{"correctness": int, "code_quality": int, "approach": int, "efficiency": int, "communication": int}}, "feedback": "str", "improvement_tips": "str"}}""",

    "parse_resume": """Extract structured information from this resume text. Return ONLY valid JSON with these fields:
{{
  "skills": ["list of technical and soft skills"],
  "experience": [{{"title": "job title", "company": "company name", "years": int, "bullets": ["key achievements"]}}],
  "education": [{{"degree": "degree name", "institution": "school", "year": int}}],
  "years_total": int,
  "target_roles": ["likely target job titles"]
}}

Resume text:
{text}""",

    "generate_personalized_questions": """Based on this candidate's profile, generate {count} personalized interview questions for a {role} position.

Profile:
- Skills: {skills}
- Experience: {experience_summary}
- Years: {years}

Generate questions that:
1. Test depth on their strongest listed skills
2. Probe their experience areas (what they claim vs what they know)
3. Identify gaps between current skills and target role requirements
4. Mix behavioral and technical questions based on their background

Return ONLY a JSON array of question objects:
[{{"type": "behavioral|technical|coding", "question": "question text", "category": "skill/area being tested", "difficulty": "easy|medium|hard", "reason": "why this question for this candidate"}}]""",

    "generate_summary": """Generate a session summary report.

Session type: {session_type}
Transcript:
{transcript}
Scores:
{scores}

Return ONLY valid JSON:
{{
  "overall_assessment": "2-3 sentence summary of performance",
  "key_strengths": ["strength1", "strength2", "strength3"],
  "weak_spots": ["area1", "area2"],
  "recommended_topics": ["topic to study", "topic to study"],
  "estimated_percentile": int,
  "next_steps": ["action1", "action2"]
}}""",
}

class LLMService:
    def __init__(self):
        self.provider: LLMProvider = self._get_provider()

    def _get_provider(self) -> LLMProvider:
        if settings.llm_provider == "groq":
            return GroqProvider()
        return GeminiProvider()

    async def generate_question(
        self, session_type: str, role: str, seniority: str, company: str, category: str = ""
    ) -> str:
        template_key = f"generate_{session_type}"
        template = PROMPT_TEMPLATES.get(template_key, PROMPT_TEMPLATES["generate_behavioral"])
        prompt = template.format(
            role=role, seniority=seniority, company=company, category=category
        )
        system = f"You are a {session_type} interviewer at {company}. Generate concise, relevant questions."
        return await self.provider.generate(prompt, system)

    async def evaluate_answer(
        self, session_type: str, question: str, answer: str, role: str = "",
    ) -> Dict[str, Any]:
        template_key = f"evaluate_{session_type}"
        template = PROMPT_TEMPLATES.get(template_key, PROMPT_TEMPLATES["evaluate_behavioral"])
        prompt = template.format(question=question, answer=answer, role=role, company="the company")
        system = "You are an expert interview evaluator. Provide objective, constructive feedback."
        raw = await self.provider.generate(prompt, system)
        try:
            cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {
                "scores": {"relevance": 5, "structure": 5, "clarity": 5, "depth": 5, "communication": 5},
                "feedback": "Could not parse structured evaluation. Review answer manually.",
                "improvement_tips": "N/A",
            }

    async def parse_resume(self, text: str) -> Dict[str, Any]:
        prompt = PROMPT_TEMPLATES["parse_resume"].format(text=text[:15000])
        system = "You are a resume parser. Extract structured data in JSON format only."
        raw = await self.provider.generate(prompt, system)
        try:
            cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {"skills": [], "experience": [], "education": [], "years_total": 0, "target_roles": []}

    async def generate_personalized_questions(
        self, skills: List[str], experience_summary: str, years: int, role: str, count: int = 5
    ) -> List[Dict[str, Any]]:
        prompt = PROMPT_TEMPLATES["generate_personalized_questions"].format(
            count=count, role=role, skills=skills, experience_summary=experience_summary, years=years
        )
        system = "You are an interview coach. Generate personalized questions in JSON array format only."
        raw = await self.provider.generate(prompt, system)
        try:
            cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return []

    async def generate_summary(
        self, session_type: str, transcript: List[Dict], scores: Dict
    ) -> Dict[str, Any]:
        prompt = PROMPT_TEMPLATES["generate_summary"].format(
            session_type=session_type,
            transcript=json.dumps(transcript, indent=2),
            scores=json.dumps(scores, indent=2),
        )
        system = "You are an interview coach providing a session summary in JSON format only."
        raw = await self.provider.generate(prompt, system)
        try:
            cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {
                "overall_assessment": "Session completed",
                "key_strengths": [],
                "weak_spots": [],
                "recommended_topics": [],
                "estimated_percentile": 50,
                "next_steps": [],
            }