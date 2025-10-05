"""
Whisper STT Client
HTTP client for calling external Whisper STT service
"""

import httpx
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class WhisperSTTClient:
    def __init__(self, whisper_service_url: str):
        self.whisper_service_url = whisper_service_url.rstrip('/')
        
    async def transcribe_audio(self, audio_data: bytes, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio data using external Whisper STT service
        
        Args:
            audio_data: Raw audio data
            language: Optional language code (e.g., 'en', 'es', 'fr')
            
        Returns:
            Dict containing transcription results
        """
        try:
            # Prepare form data
            files = {"audio_file": ("audio.wav", audio_data, "audio/wav")}
            data = {}
            if language:
                data["language"] = language
            
            # Make request to Whisper STT service
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.whisper_service_url}/transcribe",
                    files=files,
                    data=data
                )
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 503:
                    raise Exception("STT service not available - whisper binary or model not found")
                elif response.status_code == 408:
                    raise Exception("Transcription timeout")
                elif response.status_code == 413:
                    raise Exception("Audio file too large")
                else:
                    error_detail = response.json().get("detail", "Unknown error") if response.headers.get("content-type", "").startswith("application/json") else response.text
                    raise Exception(f"STT service error ({response.status_code}): {error_detail}")
                    
        except httpx.TimeoutException:
            raise Exception("STT service timeout")
        except httpx.ConnectError:
            raise Exception("Cannot connect to STT service")
        except Exception as e:
            logger.error(f"Whisper STT client error: {str(e)}")
            raise
    
    async def health_check(self) -> bool:
        """
        Check if Whisper STT service is healthy
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.whisper_service_url}/health")
                if response.status_code == 200:
                    data = response.json()
                    return data.get("whisper_available", False)
                return False
        except Exception as e:
            logger.warning(f"Whisper STT health check failed: {str(e)}")
            return False
