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
        
  
    async def _rate_with_gemini(
        self,
        user_prompt: str,
        ai_response: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Modified implementation: 
        1. First asks Gemini for a natural language, search-grounded response.
        2. Then, based on that context, requires Gemini to call our custom tool with the grounded answer.
        """
        evaluation_context = self._build_evaluation_context(user_prompt, ai_response, context)
        api_url = f"{self.gemini_base_url}/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}"

        # The conversation history: step 1 is to have the model respond naturally, grounded in google_search
        initial_user_prompt = evaluation_context

        chat_history = [
            {
                "role": "user",
                "parts": [{"text": f"Get all possible relevant info from google search to ground your next answer {initial_user_prompt}\n"}]
            }
        ]
        try:
            # First round: get a natural-language, Google Search grounded answer.
            first_request_body = {
                "contents": chat_history,
                "tools": [
                    {"google_search": {}}
                ]
            }
            async with httpx.AsyncClient() as client:
                first_response = await client.post(
                    api_url,
                    headers={"Content-Type": "application/json"},
                    json=first_request_body,
                    timeout=60.0
                )
                if first_response.status_code != 200:
                    print(f"Gemini API error (step 1): {first_response.status_code} {first_response.text}")
                    return {
                        "rating": 0.5,
                        "coherency": 0.5,
                        "reasoning": f"Gemini API error (step 1): {first_response.status_code}",
                        "confidence": 0.0,
                        "issues": [f"API request failed: {first_response.status_code}"]
                    }
                result1 = first_response.json()
                
                if not result1.get("candidates"):
                    return {
                        "rating": 0.5,
                        "coherency": 0.5,
                        "reasoning": "No search-grounded answer from Gemini",
                        "confidence": 0.0,
                        "issues": ["No search answer"]
                    }
                candidate1 = result1["candidates"][0]
                # Collect the model's latest natural text answer ("parts")
                assistant_parts = candidate1.get("content", {}).get("parts", [])
                print(assistant_parts, "[Gemini search-grounded answer parts]")
                # Add as assistant's message to chat history.
                chat_history.append({
                    "role": "model",
                    "parts": assistant_parts
                })
                chat_history.append({
                    "role": "user",
                    "parts": [{"text": "Relying on the above for up to date info, rate the reasonableness of the original AI response in our first user message   ."}]
                })

            # Second round: require function tool call using search-grounded context.
            # The system should call our function declaratively and this is required.
            second_request_body = {
                "contents": chat_history,
                "tools": [
                    {
                        "function_declarations": [
                            self._get_gemini_function_declaration()
                        ]
                    },
                ],
                "tool_config": {
                    "function_calling_config": {
                        "mode": "ANY",        # Prefer tool calls (could also try "REQUIRED")
                        "allowed_function_names": ["rate_response_reasonableness"]
                    }
                }
            }
            async with httpx.AsyncClient() as client:
                tool_response = await client.post(
                    api_url,
                    headers={"Content-Type": "application/json"},
                    json=second_request_body,
                    timeout=60.0
                )

                if tool_response.status_code != 200:
                    print(f"Gemini API error (tool step): {tool_response.status_code} {tool_response.text}")
                    return {
                        "rating": 0.5,
                        "coherency": 0.5,
                        "reasoning": f"Gemini API error (tool step): {tool_response.status_code}",
                        "confidence": 0.0,
                        "issues": [f"API request failed (tool): {tool_response.status_code}"]
                    }

                result2 = tool_response.json()
                if "candidates" not in result2 or not result2["candidates"]:
                    return {
                        "rating": 0.5,
                        "coherency": 0.5,
                        "reasoning": "No tool call in search-grounded context response",
                        "confidence": 0.0,
                        "issues": ["Empty tool response"]
                    }
                candidate2 = result2["candidates"][0]
                content2 = candidate2.get("content", {})
                parts2 = content2.get("parts", [])

                # Look for function call in parts
                function_call = None
                for part in parts2:
                    if "functionCall" in part:
                        function_call = part["functionCall"]
                        break

                if not function_call:
                    # Try to extract text response for debugging
                    response_text = ""
                    for part in parts2:
                        if "text" in part:
                            response_text += part["text"]
                    return {
                        "rating": 0.5,
                        "coherency": 0.5,
                        "reasoning": f"No function call in response. Text: {response_text[:100]}",
                        "confidence": 0.0,
                        "issues": ["Missing function call after search grounding"]
                    }

                # Extract arguments from function call
                arguments = function_call.get("args", {})
                print(function_call, "[Gemini function call after search grounding]")

                # Validate and normalize
                return self._validate_rating_response(arguments)

        except httpx.TimeoutException as e:
            print(f"Rating service timeout: {str(e)}")
            return {
                "rating": 0.5,
                "coherency": 0.5,
                "reasoning": f"Rating service timeout: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service timeout"]
            }
        except httpx.HTTPStatusError as e:
            print(f"Rating service HTTP status error: {str(e)}")
            return {
                "rating": 0.5,
                "coherency": 0.5,
                "reasoning": f"Rating service HTTP status error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service HTTP status error"]
            }
        except httpx.RequestError as e:
            print(f"Rating service request error: {str(e)}")
            return {
                "rating": 0.5,
                "coherency": 0.5,
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
                "coherency": 0.5,
                "reasoning": f"Rating service error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service unavailable"]
            }
    def _build_evaluation_context(self, user_prompt: str, ai_response: str, context: Optional[str] = None) -> str:
        """Build the evaluation context for the rating."""
        # Get the rubric prompt with the user prompt, AI response, and context
        evaluation_text = get_rubrics_prompt(
            user_prompt=user_prompt,
            ai_response=ai_response
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
                        "description": "What a user informed by a current web search (see your previous web search grounded response would rate this between 0 and 1.0."
                    },
                    "coherency": {
                        "type": "number",
                        "description": "Coherency score - would most users indicate this is a good response, based on common knowledge? (0.0 to 1.0), not actual truth."
                    },
                    "issues": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "Specific issues found (e.g., 'major: link-dump')."
                    }
                },
                "required": ["rating", "issues", "coherency"]
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

            # Extract and validate coherency
            coherency = float(arguments.get("coherency", 0.5))
            coherency = max(0.0, min(1.0, coherency))  # Clamp to 0-1

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
                "coherency": coherency,
                "issues": [str(issue) for issue in issues]
            }
            
        except (ValueError, TypeError) as e:
            return {
                "rating": 0.5,
                "reasoning": f"Error validating response: {str(e)}",
                "confidence": 0.0,
                "coherency": 0.5,
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
            rating = await self._rate_with_gemini(
                conv.get("prompt", ""),
                conv.get("response", "")
            )
            results.append(rating)
        
        return results

# Global instance
reasonableness_service = ReasonablenessService()
