"""
Reasonableness Rating Service

Uses Google's Gemini API with search grounding to rate the reasonableness 
of AI responses (0-1 scale) based on how well they match the user's prompt and context.
"""

import os
import httpx
import json
from typing import Dict, Any, Optional
import config
from pathlib import Path
from prompts import get_rubrics_prompt
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
    """Service for rating the reasonableness of AI responses using Gemini with search grounding."""
    
    def __init__(self):
        # Always use Gemini API with grounding
        self.gemini_api_key = config.RATING_INFERENCE_KEY
        self.gemini_base_url = config.RATING_INFERENCE_URL
        self.gemini_model = config.RATING_INFERENCE_MODEL
        self.use_gemini = True
        self.use_grounding = True  # Always enable Google Search grounding
        
        if not self.gemini_api_key:
            print("❌ No Gemini API key found!")
        else:
            print(f"✅ Using Gemini API ({self.gemini_model}) with Google Search grounding enabled")
            print(f"🔑 API Key: {self.gemini_api_key[:10]}..." if len(self.gemini_api_key) > 10 else "🔑 API Key set")
        
    async def rate_response(
        self, 
        user_prompt: str, 
        ai_response: str, 
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rate the reasonableness of an AI response on a 0-1 scale using Gemini with Google Search grounding.
        
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
        # Always use Gemini with grounding
        return await self._rate_with_gemini(user_prompt, ai_response, context)
    
    async def _rate_with_gemini(
        self,
        user_prompt: str,
        ai_response: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Rate using Gemini API with search grounding."""
        evaluation_context = self._build_evaluation_context(user_prompt, ai_response, context)
        
        try:
            # Build Gemini API request with API key as URL parameter (more reliable than header)
            api_url = f"{self.gemini_base_url}/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}"
            print(f"API URL: {api_url[:-6]}...")
            
            # Construct request body with grounding (no function calling, as they're mutually exclusive)
            request_body = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": f"""You are an expert evaluator of AI responses. Rate responses on reasonableness, not factual accuracy.

{evaluation_context}

You must respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, just the raw JSON):
{{
  "rating": <number between 0.0 and 1.0>,
  "reasoning": "<brief explanation>",
  "confidence": <number between 0.0 and 1.0>,
  "issues": ["<issue1>", "<issue2>", ...]
}}
Make sure that oss isn't missing current info 
Have to different answers for rating, one is critical errors and one is not correct answers.
Use Google Search grounding to verify facts if needed. Be thorough and accurate."""
                            }
                        ]
                    }
                ],
                "tools": [
                    {
                        "google_search": {}
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    api_url,
                    headers={
                        "Content-Type": "application/json"
                    },
                    json=request_body,
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    print(f"Gemini API error: {response.status_code} {response.text}")
                    return {
                        "rating": 0.5,
                        "reasoning": f"Gemini API error: {response.status_code}",
                        "confidence": 0.0,
                        "issues": [f"API request failed: {response.status_code}"]
                    }
                
                result = response.json()
                
                # Extract text response from Gemini
                if "candidates" not in result or not result["candidates"]:
                    return {
                        "rating": 0.5,
                        "reasoning": "No response from Gemini",
                        "confidence": 0.0,
                        "issues": ["Empty response"]
                    }
                
                candidate = result["candidates"][0]
                content = candidate.get("content", {})
                parts = content.get("parts", [])
                
                # Extract text from parts
                response_text = ""
                for part in parts:
                    if "text" in part:
                        response_text += part["text"]
                
                if not response_text:
                    return {
                        "rating": 0.5,
                        "reasoning": "No text found in Gemini response",
                        "confidence": 0.0,
                        "issues": ["Missing text"]
                    }
                
                # Parse JSON from response text
                # Remove markdown code blocks if present
                response_text = response_text.strip()
                if response_text.startswith("```"):
                    # Extract JSON from code block
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1]) if len(lines) > 2 else response_text
                
                # Find JSON object in text
                try:
                    # Try to find JSON object
                    start_idx = response_text.find("{")
                    end_idx = response_text.rfind("}") + 1
                    if start_idx != -1 and end_idx > start_idx:
                        json_text = response_text[start_idx:end_idx]
                        arguments = json.loads(json_text)
                    else:
                        raise ValueError("No JSON object found in response")
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"Failed to parse Gemini response as JSON: {e}")
                    print(f"Response text: {response_text[:500]}")
                    return {
                        "rating": 0.5,
                        "reasoning": f"Failed to parse response: {str(e)}",
                        "confidence": 0.0,
                        "issues": ["JSON parsing failed"]
                    }
                
                # Validate and return
                return self._validate_rating_response(arguments)
        
        except httpx.TimeoutException as e:
            print(f"Gemini timeout: {str(e)}")
            return {
                "rating": 0.5,
                "reasoning": f"Gemini timeout: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service timeout"]
            }
        except Exception as e:
            print(f"Gemini error: {str(e)}")
            return {
                "rating": 0.5,
                "reasoning": f"Gemini error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service error"]
            }
    

    
    def _build_evaluation_context(self, user_prompt: str, ai_response: str, context: Optional[str] = None) -> str:
        """Build the evaluation context for the rating tool call."""
        
        RUBRIC_SYSTEM_PROMPT = get_rubrics_prompt(user_prompt=user_prompt, ai_response=ai_response, context=str(context))

        return RUBRIC_SYSTEM_PROMPT
    def _get_gemini_rating_function(self) -> Dict[str, Any]:
        """Get the Gemini function declaration for rating responses."""
        return {
            "name": "rate_response_reasonableness",
            "description": "Rate the reasonableness of an AI response on a 0-1 scale.",
            "parameters": {
                "type": "object",
                "properties": {
                    "rating": {
                        "type": "number",
                        "description": "Reasonableness rating from 0.0 to 1.0 (one decimal)."
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Brief explanation of the rating."
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Confidence in this rating from 0.0 to 1.0."
                    },
                    "issues": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific reasonableness issues found."
                    }
                },
                "required": ["rating", "reasoning", "confidence", "issues"]
            }
        }
    
    def _get_rating_tool_definition(self) -> Dict[str, Any]:
        """Get the OpenAI-compatible tool definition for rating responses (Perplexity fallback)."""
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
                    "description": "Specific reasonableness issues found."
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
