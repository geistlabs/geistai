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


class ReasonablenessService:
    """Service for rating the reasonableness of AI responses."""
    
    def __init__(self):
        self.base_url = config.INFERENCE_URL
        
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
      
        
    
        # Construct the rating prompt
        rating_prompt = self._build_rating_prompt(user_prompt, ai_response, context)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                   
                    json={
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert evaluator of AI responses. Rate responses on reasonableness, not accuracy."
                            },
                            {
                                "role": "user",
                                "content": rating_prompt
                            }
                        ],
                        "temperature": 0.1,  # Low temperature for consistent ratings
                        "max_tokens": 500
                    },
                    timeout=30.0
                )
                if response.status_code != 200:
                    return {
                        "rating": 0.5,
                        "reasoning": f"Rating API error: {response.status_code}",
                        "confidence": 0.0,
                        "issues": ["API request failed"]
                    }
                
                result = response.json()
                rating_text = result["choices"][0]["message"]["content"]
                # Parse the rating response
                return self._parse_rating_response(rating_text)
                
        except Exception as e:
            return {
                "rating": 0.5,
                "reasoning": f"Rating service error: {str(e)}",
                "confidence": 0.0,
                "issues": ["Service unavailable"]
            }
    
    def _build_rating_prompt(self, user_prompt: str, ai_response: str, context: Optional[str] = None) -> str:
        """Build the prompt for rating the response."""
        
        prompt = f"""Rate the reasonableness of this AI response on a scale of 0-1, where:
- 1.0 = Perfectly reasonable, directly addresses the prompt, appropriate tone and length
- 0.8-0.9 = Very reasonable, minor issues
- 0.6-0.7 = Reasonably good, some issues but mostly appropriate
- 0.4-0.5 = Somewhat reasonable, notable issues
- 0.2-0.3 = Not very reasonable, significant problems
- 0.0-0.1 = Completely unreasonable, inappropriate, or irrelevant

USER PROMPT: "{user_prompt}"

AI RESPONSE: "{ai_response}"
"""

        if context:
            prompt += f"\nADDITIONAL CONTEXT: {context}"

        prompt += """

Please respond with a JSON object containing:
{
    "rating": <float between 0.0 and 1.0>,
    "reasoning": "<brief explanation of the rating>",
    "confidence": <float between 0.0 and 1.0 indicating your confidence in this rating>,
    "issues": ["<list of specific issues found, if any>"]
}

Focus on:
- Does the response address what the user asked?
- Is the tone appropriate?
- Is the length reasonable for the question?
- Are there any obvious errors or inconsistencies?
- Is the response helpful and relevant?

Rate based on reasonableness, not factual accuracy."""

        return prompt
    
    def _parse_rating_response(self, rating_text: str) -> Dict[str, Any]:
        """Parse the rating response from the AI."""
        
        try:
            # Try to extract JSON from the response
            import re
            
            # Look for JSON in the response
            json_match = re.search(r'\{.*\}', rating_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                rating_data = json.loads(json_str)
                
                # Validate and normalize the response
                rating = float(rating_data.get("rating", 0.5))
                rating = max(0.0, min(1.0, rating))  # Clamp to 0-1
                
                confidence = float(rating_data.get("confidence", 0.5))
                confidence = max(0.0, min(1.0, confidence))  # Clamp to 0-1
                
                return {
                    "rating": rating,
                    "reasoning": str(rating_data.get("reasoning", "No reasoning provided")),
                    "confidence": confidence,
                    "issues": rating_data.get("issues", [])
                }
            else:
                # Fallback parsing if no JSON found
                return self._fallback_parse(rating_text)
                
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            # Fallback parsing
            return self._fallback_parse(rating_text)
    
    def _fallback_parse(self, rating_text: str) -> Dict[str, Any]:
        """Fallback parsing when JSON parsing fails."""
        
        # Try to extract a number from the text
        import re
        
        # Look for numbers that could be ratings
        numbers = re.findall(r'\b(0\.\d+|\d+\.\d+)\b', rating_text)
        
        if numbers:
            try:
                rating = float(numbers[0])
                rating = max(0.0, min(1.0, rating))
            except ValueError:
                rating = 0.5
        else:
            rating = 0.5
        
        return {
            "rating": rating,
            "reasoning": f"Fallback parsing: {rating_text[:200]}...",
            "confidence": 0.3,  # Lower confidence for fallback
            "issues": ["Could not parse structured rating"]
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
