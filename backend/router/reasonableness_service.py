"""
Reasonableness Rating Service

Uses Google's Gemini API to rate the reasonableness of AI responses (0-1 scale)
based on how well they match the user's prompt and context.
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
    """Service for rating the reasonableness of AI responses using Gemini API."""
    
    def __init__(self):
        self.gemini_base_url = config.RATING_INFERENCE_URL
        self.gemini_api_key = config.RATING_INFERENCE_KEY
        self.gemini_model = config.RATING_INFERENCE_MODEL
        
        if not self.gemini_api_key:
            print("❌ No Gemini API key found!")
        else:
            print(f"✅ Using Gemini API ({self.gemini_model}) with function calling")
            print(f"🔑 API Key: {self.gemini_api_key[:10]}..." if len(self.gemini_api_key) > 10 else "🔑 API Key set")
        
    async def rate_response(
        self, 
        user_prompt: str, 
        ai_response: str, 
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rate the reasonableness of an AI response on a 0-1 scale using Gemini.
        
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
        return await self._rate_with_gemini(user_prompt, ai_response, context)
    
    async def _rate_with_gemini(
        self,
        user_prompt: str,
        ai_response: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Rate using Gemini API with function calling."""
        evaluation_context = self._build_evaluation_context(user_prompt, ai_response, context)
        
        try:
            # Build Gemini API request with API key as URL parameter
            api_url = f"{self.gemini_base_url}/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}"
            
            # Construct request body with function declaration (Gemini format)
            request_body = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": evaluation_context
                            }
                        ]
                    }
                ],
                "tools": [
                    {
                        "function_declarations": [
                            self._get_gemini_function_declaration()
                        ]
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
                
                # Extract function call from Gemini response
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
                
                # Look for function call in parts
                function_call = None
                for part in parts:
                    if "functionCall" in part:
                        function_call = part["functionCall"]
                        break
                
                if not function_call:
                    # If no function call, try to extract text response
                    response_text = ""
                    for part in parts:
                        if "text" in part:
                            response_text += part["text"]
                    
                    return {
                        "rating": 0.5,
                        "reasoning": f"No function call in response. Text: {response_text[:100]}",
                        "confidence": 0.0,
                        "issues": ["Missing function call"]
                    }
                
                # Extract arguments from function call
                arguments = function_call.get("args", {})
                
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
            import traceback
            traceback.print_exc()
            return {
                "rating": 0.5,
                "reasoning": f"Rating service error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service unavailable"]
            }
    
    def _build_evaluation_context(self, user_prompt: str, ai_response: str, context: Optional[str] = None) -> str:
        """Build the evaluation context for the rating."""
        # Get the rubric prompt with the user prompt, AI response, and context
        evaluation_text = get_rubrics_prompt(
            user_prompt=user_prompt,
            ai_response=ai_response,
            context=context if context else "No additional context"
        )
        
        return evaluation_text
    
    def _get_gemini_function_declaration(self) -> Dict[str, Any]:
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
                        "description": "Confidence in this rating (0.0 to 1.0)."
                    },
                    "issues": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "Specific issues found (e.g., 'major: link-dump')."
                    }
                },
                "required": ["rating", "reasoning", "confidence", "issues"]
            }
        }
    
    def _validate_rating_response(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize the rating response from the function call."""
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
