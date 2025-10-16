"""
Reasonableness Rating Service

Uses OpenAI's API to rate the reasonableness of AI responses (0-1 scale)
based on how well they match the user's prompt and context.
"""

import os
import httpx
import json
from typing import Dict, Any, Optional
import config
from pathlib import Path

# Load .env file from parent directory when running locally
try:
    from dotenv import load_dotenv
    # Get the directory where this config.py file is located
    current_dir = Path(__file__).parent
    # Go up one directory to find the .env file
    parent_dir = current_dir.parent
    env_file = parent_dir / ".env"
    
    if env_file.exists():
        load_dotenv(env_file)
        print(f"Loaded environment variables from: {env_file}")
    else:
        print(f"No .env file found at: {env_file}")
except ImportError:
    print("python-dotenv not installed, skipping .env file loading")
except Exception as e:
    print(f"Error loading .env file: {e}")


class ReasonablenessService:
    """Service for rating the reasonableness of AI responses."""
    
    def __init__(self):
        self.base_url = config.REMOTE_INFERENCE_URL
        self.api_key = config.OPENAI_KEY
        
    async def rate_response(
        self, 
        user_prompt: str, 
        ai_response: str, 
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rate the reasonableness of an AI response on a 0-1 scale.
        
        Args:
            user_prompt: The original user prompt/question
            ai_response: The AI's response to rate
            context: Optional additional context (conversation history, etc.)
            
        Returns:
            Dict containing:
            - rating: float (0-1)
            - reasoning: str (explanation of the rating)
            - confidence: float (0-1, how confident the rating is)
            - issues: list of specific issues found
        """
        # Construct the evaluation context
        evaluation_context = self._build_evaluation_context(user_prompt, ai_response, context)
          
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert evaluator of AI responses. You must use the provided tool to return your rating as structured JSON. Rate responses on reasonableness, not factual accuracy."
                            },
                            {
                                "role": "user",
                                "content": evaluation_context
                            }
                        ],
                        "model": "gpt-4o-mini",
                        "tools": [self._get_rating_tool_definition()],
                        "tool_choice": "auto",
                    }
                    ,
                    timeout=300.0
                )
                if response.status_code != 200:
                    print(f"Rating API error: {response.status_code} {response.text}")
                    return {
                
                        "rating": 0.5,
                        "reasoning": f"Rating API error: {response.status_code}",
                        "confidence": 0.0,
                        "issues": [f"API request failed: {response.status_code} {response.text}"]
                    }
                
                result = response.json()
                # Extract the tool call response
                tool_calls = result["choices"][0]["message"].get("tool_calls", [])
                if not tool_calls:
                    return {
                        "rating": 0.5,
                        "reasoning": "No tool call found in response",
                        "confidence": 0.0,
                        "issues": ["Missing tool call"]
                    }
                
                # Parse the structured response from the tool call
                tool_call = tool_calls[0]
                arguments = json.loads(tool_call["function"]["arguments"])
                
                # Validate and normalize the response
                return self._validate_rating_response(arguments)

        except httpx.TimeoutException as e:
            print(f"Rating service timeout: {str(e)}")
            return {
                "rating": 0.5,
                "reasoning": f"Rating service timeout: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service timeout"]
            }
        except httpx.HTTPStatusError as e:
            print(f"Rating service HTTP status error: {str(e)}")
            return {
                "rating": 0.5,
                "reasoning": f"Rating service HTTP status error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service HTTP status error"]
            }
        except httpx.RequestError as e:
            print(f"Rating service request error: {str(e)}")
            return {
                "rating": 0.5,
                "reasoning": f"Rating service request error: {str(e)}",
                "confidence": 0.0,
                "issues": [f"Rating service request error: {str(e)}"]
            }
        except Exception as e:
            print(f"Rating service error: {str(e)}")
            return {
                "rating": 0.5,
                "reasoning": f"Rating service error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service unavailable"]
            }
    
    def _build_evaluation_context(self, user_prompt: str, ai_response: str, context: Optional[str] = None) -> str:
        """Build the evaluation context for the rating tool call."""
        
        RUBRIC_SYSTEM_PROMPT = (
            "You are a strict but fair grader of AI responses for overall REASONABLENESS (not factual accuracy).\n"
            "\n"
            "OUTPUT FORMAT: Call the grading function tool EXACTLY ONCE. No prose.\n"
            "\n"
            "WHAT TO JUDGE (only these):\n"
            "- Intent match: did it answer what was asked?\n"
            "- Constraint adherence (format/style/length).\n"
            "- Helpfulness & specificity for the user’s ask.\n"
            "- Tone appropriateness.\n"
            "- Obvious errors/contradictions.\n"
            "- Genre appropriateness: do NOT penalize brevity when the genre warrants short turns (e.g., roleplay beats).\n"
            "\n"
            "LINKS & EXTRACTION POLICY:\n"
            "- MAJOR issue: user asked to extract/summarize from a URL or page and the assistant link-dumps instead.\n"
            "- MINOR issue: for general queries, the assistant links but also provides a usable summary.\n"
            "\n"
            "SCORING (use the full 0.0–1.0 scale; do NOT default to 0.6):\n"
            "- 1.0  Excellent: direct, helpful, on-tone, fits constraints; no meaningful issues.\n"
            "- 0.9  Very good: minor nit(s) only; still clearly excellent for the user.\n"
            "- 0.8  Good: a couple small issues (slight verbosity/omissions) but solid overall.\n"
            "- 0.7  Fair: one notable issue that reduces usefulness, yet answer still serviceable.\n"
            "- 0.6  Marginal: multiple minors or one clear major that materially harms usefulness.\n"
            "- 0.5  Weak: major issues; partially useful but notably flawed.\n"
            "- 0.3  Poor: largely unhelpful/incorrect format or ignores key constraints.\n"
            "- 0.1  Bad: off-topic/irrelevant/unsafe; no meaningful help.\n"
            "\n"
            "MAPPING RULE:\n"
            "- Identify issues → choose the closest band from the descriptors above.\n"
            "- Round to ONE decimal. Do not compute long penalties; pick the nearest band.\n"
            "\n"
            "CONFIDENCE:\n"
            "- 0.9 clear-cut; 0.6 mixed; 0.3 borderline/ambiguous.\n"
            "\n"
            "CALIBRATION EXAMPLES (anchor your scale to these):\n"
            "- 1.0  User: \"Give LaTeX quadratic formula.\" Assistant: \"\\[x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\]\"\n"
            "- 0.9  ROLEPLAY beat (short, in-character, on-tone): User starts scene; Assistant replies with a single in-character line that advances the scene.\n"
            "- 0.9  TONE analysis follow-up: User asks overall tone beyond pos/neg; Assistant concisely labels it (e.g., \"mostly disappointed but appreciative\") and cites which parts.\n"
            "- 0.8  User: \"2 sentences.\" Assistant gives 4 but helpful and correct.\n"
            "- 0.6  User: \"Summarize key numbers from <url>.\" Assistant points to link with minimal/no extraction (major: link-dump).\n"
            "- 0.3  User asks for a summary; Assistant writes unrelated content.\n"
            "\n"
            "Now grade the item below by CALLING THE TOOL:\n"
            "\n"
            f"USER PROMPT:\n{user_prompt}\n"
            f"AI RESPONSE:\n{ai_response}\n"
            "\n"
            f"OPTIONAL CONTEXT:\n{context}\n"
        )

        return RUBRIC_SYSTEM_PROMPT
    def _get_rating_tool_definition(self) -> Dict[str, Any]:
        """Get the tool definition for rating responses."""
        return {
    "type": "function",
    "function": {
        "name": "rate_response_reasonableness",
        "description": "Rate the reasonableness of an AI response on a 0-1 scale.",
        "parameters": {
            "type": "object",
            "properties": {
                "rating": {
                    "type": "number", "minimum": 0.0, "maximum": 1.0,
                    "description": "Reasonableness rating from 0.0 to 1.0 (one decimal)."
                },
                "reasoning": {
                    "type": "string",
                    "description": "Brief explanation of the rating."
                },
                "confidence": {
                    "type": "number", "minimum": 0.0, "maximum": 1.0,
                    "description": "Confidence in this rating."
                },
                "issues": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific issues found (e.g., 'major: link-dump')."
                }
            },
            "required": ["rating", "reasoning", "confidence", "issues"]
        }
    }
}
    
    def _validate_rating_response(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize the rating response from the tool call."""
        try:
            # Extract and validate rating
            rating = float(arguments.get("rating", 0.5))
            rating = max(0.0, min(1.0, rating))  # Clamp to 0-1
            
            # Extract and validate confidence
            confidence = float(arguments.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))  # Clamp to 0-1
            
            # Extract other fields
            reasoning = str(arguments.get("reasoning", "No reasoning provided"))
            issues = arguments.get("issues", [])
            
            # Ensure issues is a list
            if not isinstance(issues, list):
                issues = [str(issues)] if issues else []
            
            return {
                "rating": rating,
                "reasoning": reasoning,
                "confidence": confidence,
                "issues": [str(issue) for issue in issues]
            }
            
        except (ValueError, TypeError) as e:
            return {
                "rating": 0.5,
                "reasoning": f"Error validating response: {str(e)}",
                "confidence": 0.0,
                "issues": ["Response validation failed"]
            }
    
    
    async def batch_rate_responses(
        self, 
        conversations: list[Dict[str, str]]
    ) -> list[Dict[str, Any]]:
        """
        Rate multiple responses in batch.
        
        Args:
            conversations: List of dicts with 'prompt' and 'response' keys
            
        Returns:
            List of rating results
        """
        
        results = []
        
        for conv in conversations:
            rating = await self.rate_response(
                conv.get("prompt", ""),
                conv.get("response", ""),
                conv.get("context")
            )
            results.append(rating)
        
        return results


# Global instance
reasonableness_service = ReasonablenessService()
