from typing import List, Dict, Any

SCORING_DIMENSIONS = {
    "behavioral": ["relevance", "structure", "clarity", "depth", "communication"],
    "technical": ["correctness", "depth", "clarity", "communication", "completeness"],
    "coding": ["correctness", "code_quality", "approach", "efficiency", "communication"],
    "system_design": ["requirements", "estimation", "data_model", "api_design", "architecture", "deep_dive"],
}

class ScoringService:
    def calculate_overall(self, transcript: List[Dict[str, Any]], session_type: str) -> Dict[str, Any]:
        dimensions = SCORING_DIMENSIONS.get(session_type, SCORING_DIMENSIONS["behavioral"])

        dimension_scores = {d: [] for d in dimensions}
        for entry in transcript:
            evals = entry.get("evaluation", {})
            for dim in dimensions:
                score = evals.get(dim)
                if score is not None:
                    dimension_scores[dim].append(score)

        averages = {}
        for dim, scores in dimension_scores.items():
            if scores:
                averages[dim] = sum(scores) / len(scores)
        
        return averages