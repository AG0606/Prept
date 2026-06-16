import json
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.session import Session, SessionType, SessionStatus
from ..models.feedback import Feedback
from .llm_service import LLMService
from .scoring_service import ScoringService
from .question_generator import QuestionGenerator

SESSION_TYPE_PROMPTS = {
    "behavioral": {
        "system": "You are a behavioral interviewer at a top tech company. Ask behavioral questions using the STAR framework. Evaluate answers based on Situation, Task, Action, Result structure, relevance, clarity, and depth. Provide constructive feedback after each answer.",
        "generate": "Generate a behavioral interview question for a {role} position at {company} (seniority: {seniority}). Focus on {category}. Return ONLY the question text.",
        "evaluate": "Evaluate this answer to the behavioral question. Score 1-10 on: relevance, structure (STAR), clarity, depth, communication. Return JSON: {{'scores': {{'relevance': int, 'structure': int, 'clarity': int, 'depth': int, 'communication': int}}, 'feedback': str, 'improvement_tips': str, 'follow_up': str}}",
    },
    "technical": {
        "system": "You are a technical interviewer at a top tech company. Ask technical concept questions covering algorithms, data structures, system design concepts, programming paradigms, and CS fundamentals.",
        "generate": "Generate a technical interview question for a {role} at {company} (seniority: {seniority}). Ask about: {category}. Return ONLY the question text.",
        "evaluate": "Evaluate this technical answer. Score 1-10 on: correctness, depth, clarity, communication, completeness. Return JSON: {{'scores': {{'correctness': int, 'depth': int, 'clarity': int, 'communication': int, 'completeness': int}}, 'feedback': str, 'improvement_tips': str, 'follow_up': str}}",
    },
    "coding": {
        "system": "You are a coding interviewer at a top tech company. Present coding problems and evaluate solutions based on correctness, efficiency, code quality, and communication.",
        "generate": "This session uses curated problems from the problem bank. Pick problems matching {role}, {seniority} difficulty.",
        "evaluate": "Evaluate this coding solution. Consider: test results (passed/failed), code quality, approach, time & space complexity awareness, edge case handling. Return JSON: {{'scores': {{'correctness': int, 'code_quality': int, 'approach': int, 'efficiency': int, 'communication': int}}, 'feedback': str, 'improvement_tips': str}}",
    },
    "system_design": {
        "system": "You are a system design interviewer at a top tech company. Guide candidates through designing large-scale systems. Cover requirements, estimation, data model, API design, high-level architecture, and deep dives.",
        "generate": "This session uses curated system design topics. Guide the candidate through: requirements gathering, estimation, data model, API design, architecture, deep dive.",
        "evaluate": "Based on the checkpoint evaluation from vision_service and chat history, provide a summary score. Return JSON: {{'scores': {{'requirements': int, 'estimation': int, 'data_model': int, 'api_design': int, 'architecture': int, 'deep_dive': int}}, 'feedback': str, 'improvement_tips': str}}",
    },
}

class InterviewEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.llm = LLMService()
        self.scorer = ScoringService()
        self.qgen = QuestionGenerator()

    async def create(
        self,
        session_type: SessionType,
        role: str,
        seniority: str = "mid",
        company_focus: str = "",
        resume_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        session = Session(
            session_type=session_type,
            role=role,
            seniority=seniority,
            company_focus=company_focus or "a top tech company",
            resume_id=resume_id,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return {
            "id": session.id,
            "session_type": session.session_type.value,
            "status": session.status.value,
            "role": session.role,
        }

    async def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return None
        return {
            "id": session.id,
            "session_type": session.session_type.value,
            "status": session.status.value,
            "role": session.role,
            "seniority": session.seniority,
            "company_focus": session.company_focus,
            "current_question_index": session.current_question_index,
            "questions": session.questions,
            "transcript": session.transcript,
            "scores": session.scores,
            "created_at": session.created_at.isoformat(),
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        }

    async def start(self, session_id: str) -> Dict[str, Any]:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return {"error": "Session not found"}

        session.status = SessionStatus.in_progress
        questions = await self.qgen.generate_questions(
            session.session_type.value,
            session.role,
            session.seniority,
            session.resume_id,
        )
        session.questions = questions
        await self.db.commit()
        await self.db.refresh(session)

        return {
            "session_id": session.id,
            "status": "in_progress",
            "first_question": questions[0] if questions else None,
            "total_questions": len(questions),
        }

    async def process_answer(
        self, session_id: str, question_index: int, answer: str
    ) -> Dict[str, Any]:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return {"error": "Session not found"}

        questions = session.questions or []
        if question_index >= len(questions):
            return {"error": "Question index out of range"}

        question = questions[question_index]
        prompt_info = SESSION_TYPE_PROMPTS.get(session.session_type.value, SESSION_TYPE_PROMPTS["technical"])

        evaluation = await self.llm.evaluate_answer(
            session.session_type.value,
            question.get("question", question.get("title", "")),
            answer,
            session.role,
        )

        entry = {
            "question_index": question_index,
            "question": question.get("question", question.get("title", "")),
            "answer": answer,
            "evaluation": evaluation.get("scores", {}),
            "feedback": evaluation.get("feedback", ""),
            "improvement_tips": evaluation.get("improvement_tips", ""),
        }
        transcript = session.transcript or []
        transcript.append(entry)
        session.transcript = transcript

        feedback = Feedback(
            session_id=session.id,
            question_index=question_index,
            question=entry["question"],
            answer=answer,
            dimensions=evaluation.get("scores", {}),
            overall_score=sum(evaluation.get("scores", {}).values()) / max(len(evaluation.get("scores", {})), 1),
            ai_feedback=evaluation.get("feedback", ""),
            improvement_tips=evaluation.get("improvement_tips", ""),
        )
        self.db.add(feedback)

        next_index = question_index + 1
        session.current_question_index = next_index

        if next_index >= len(questions):
            session.status = SessionStatus.completed
            session.completed_at = datetime.utcnow()
            overall = self.scorer.calculate_overall(transcript, session.session_type.value)
            session.scores = overall
        else:
            next_q = questions[next_index]

        await self.db.commit()
        await self.db.refresh(session)

        response = {
            "evaluation": evaluation,
            "current_index": next_index,
        }
        if next_index < len(questions):
            response["next_question"] = questions[next_index]
        else:
            response["session_complete"] = True
            response["overall_scores"] = session.scores

        return response

    async def skip(self, session_id: str) -> Dict[str, Any]:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return {"error": "Session not found"}

        questions = session.questions or []
        next_index = session.current_question_index + 1
        session.current_question_index = next_index

        if next_index >= len(questions):
            session.status = SessionStatus.completed
            session.completed_at = datetime.utcnow()

        await self.db.commit()
        return {
            "session_id": session.id,
            "current_index": next_index,
            "next_question": questions[next_index] if next_index < len(questions) else None,
            "session_complete": next_index >= len(questions),
        }

    async def get_feedback(self, session_id: str) -> Dict[str, Any]:
        result = await self.db.execute(
            select(Feedback).where(Feedback.session_id == session_id).order_by(Feedback.question_index)
        )
        feedbacks = result.scalars().all()
        return {"feedback": [f.__dict__ for f in feedbacks]}

    async def get_report(self, session_id: str) -> Dict[str, Any]:
        result = await self.db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return {"error": "Session not found"}
        feedbacks = await self.get_feedback(session_id)

        summary = await self.llm.generate_summary(
            session.session_type.value,
            session.transcript or [],
            session.scores or {},
        )

        return {
            "session": {
                "id": session.id,
                "type": session.session_type.value,
                "role": session.role,
                "seniority": session.seniority,
                "status": session.status.value,
                "created_at": session.created_at.isoformat(),
            },
            "scores": session.scores or {},
            "feedback": feedbacks,
            "summary": summary,
            "weak_spots": summary.get("weak_spots", []),
            "recommended_topics": summary.get("recommended_topics", []),
        }