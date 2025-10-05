"""
Standalone Whisper STT Service
FastAPI service for speech-to-text using whisper.cpp
"""

import os
import tempfile
import subprocess
import json
from typing import Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Whisper STT Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WhisperSTTService:
    def __init__(self, whisper_path: str, model_path: str):
        self.whisper_path = whisper_path
        self.model_path = model_path

    def transcribe_audio(self, audio_data: bytes, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio data using whisper.cpp

        Args:
            audio_data: Raw audio data
            language: Optional language code (e.g., 'en', 'es', 'fr')

        Returns:
            Dict containing transcription results
        """
        try:
            # Create temporary file for audio data
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_audio_path = temp_file.name

            try:
                # Build whisper command
                cmd = [self.whisper_path, "-m", self.model_path, "-f", temp_audio_path]

                # Add language if specified
                if language:
                    cmd.extend(["-l", language])

                # Add output format (JSON)
                cmd.extend(["-oj"])

                # Run whisper
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

                if result.returncode != 0:
                    raise Exception(f"Whisper failed: {result.stderr}")

                # Parse JSON output
                output_lines = result.stdout.strip().split('\n')
                json_line = None
                for line in output_lines:
                    if line.startswith('{'):
                        json_line = line
                        break

                if json_line:
                    transcription_data = json.loads(json_line)
                    return {
                        "success": True,
                        "text": transcription_data.get("text", "").strip(),
                        "language": transcription_data.get("language", language),
                        "segments": transcription_data.get("segments", []),
                        "duration": transcription_data.get("duration", 0)
                    }
                else:
                    # Fallback: extract text from stdout
                    text = result.stdout.strip()
                    return {
                        "success": True,
                        "text": text,
                        "language": language,
                        "segments": [],
                        "duration": 0
                    }

            finally:
                # Clean up temporary file
                os.unlink(temp_audio_path)

        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=408, detail="Transcription timeout")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# Initialize STT service
whisper_path = os.getenv("WHISPER_BINARY_PATH", "/usr/local/bin/whisper-cli")
model_path = os.getenv("WHISPER_MODEL_PATH", "/models/ggml-base.bin")

stt_service = None
if os.path.exists(whisper_path) and os.path.exists(model_path):
    stt_service = WhisperSTTService(whisper_path, model_path)
    print(f"✅ Whisper STT service initialized")
    print(f"   Binary: {whisper_path}")
    print(f"   Model: {model_path}")
else:
    print(f"❌ Whisper STT service not available")
    print(f"   Binary exists: {os.path.exists(whisper_path)}")
    print(f"   Model exists: {os.path.exists(model_path)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "whisper-stt",
        "whisper_available": stt_service is not None
    }

@app.post("/transcribe")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Transcribe uploaded audio file

    Args:
        audio_file: Audio file (WAV, MP3, etc.)
        language: Optional language code

    Returns:
        Transcription result
    """
    if not stt_service:
        raise HTTPException(
            status_code=503,
            detail="STT service not available - whisper binary or model not found"
        )

    try:
        # Read audio data
        audio_data = await audio_file.read()

        if not audio_data:
            raise HTTPException(status_code=400, detail="Empty audio file")

        # Transcribe
        result = stt_service.transcribe_audio(audio_data, language)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/info")
async def get_info():
    """Get service information"""
    return {
        "service": "whisper-stt",
        "version": "1.0.0",
        "whisper_path": whisper_path,
        "model_path": model_path,
        "whisper_available": stt_service is not None,
        "endpoints": {
            "health": "/health",
            "transcribe": "/transcribe",
            "info": "/info"
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8004))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
