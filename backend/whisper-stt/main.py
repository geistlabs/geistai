"""
Standalone Whisper STT Service
FastAPI service for speech-to-text using whisper.cpp
"""

import os
import tempfile
import subprocess
import json
import platform
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler - runs once on startup"""
    print("🚀 Lifespan startup event triggered")
    
    # Startup: Log system info and initialization status
    if stt_service:
        print("=" * 60)
        print("WHISPER STT SERVICE - SYSTEM INFO")
        print("=" * 60)
        print(f"Platform: {platform.system()} {platform.release()}")
        print(f"Architecture: {platform.machine()}")
        print(f"Python: {platform.python_version()}")

        # Check for NVIDIA GPU
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=name,driver_version', '--format=csv,noheader'],
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and result.stdout.strip():
                print("GPU: NVIDIA GPU DETECTED")
                for line in result.stdout.strip().split('\n'):
                    parts = line.split(', ')
                    if len(parts) >= 2:
                        print(f"  - {parts[0]} (Driver: {parts[1]})")
            else:
                print("GPU: No NVIDIA GPU detected (CPU-only mode)")
        except Exception:
            print("GPU: No NVIDIA GPU detected (CPU-only mode)")

        print(f"Whisper Binary: {stt_service.whisper_path}")
        print(f"Whisper Model: {stt_service.model_path}")
        print("=" * 60)
        print(f"✅ Whisper STT service ready")
    else:
        print(f"❌ Whisper STT service not available")

    yield

    # Shutdown: cleanup if needed
    pass

app = FastAPI(title="Whisper STT Service", version="1.0.0", lifespan=lifespan)

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
                # Build whisper command (disable timestamps at the source)
                cmd = [
                    self.whisper_path,
                    "-m",
                    self.model_path,
                    "-f",
                    temp_audio_path,
                    "-nt",  # no timestamps in output
                ]

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
                    raw_text = transcription_data.get("text", "") or ""
                    # Safety net: strip any bracketed timestamps if present
                    import re
                    cleaned_text = re.sub(
                        r"\s*\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\s*--?>\s*\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]\s*",
                        "",
                        raw_text,
                    ).strip()
                    return {
                        "success": True,
                        "text": cleaned_text,
                        "language": transcription_data.get("language", language),
                        "segments": transcription_data.get("segments", []),
                        "duration": transcription_data.get("duration", 0),
                    }
                else:
                    # Fallback: extract text from stdout
                    import re
                    text = result.stdout.strip()
                    cleaned_text = re.sub(
                        r"\s*\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\s*--?>\s*\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]\s*",
                        "",
                        text,
                    ).strip()
                    return {
                        "success": True,
                        "text": cleaned_text,
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

# Initialize STT service (logging happens in lifespan event to avoid duplicates)
whisper_path = os.getenv("WHISPER_BINARY_PATH", "/usr/local/bin/whisper-cli")
model_path = os.getenv("WHISPER_MODEL_PATH", "/models/ggml-base.bin")

stt_service = None
if os.path.exists(whisper_path) and os.path.exists(model_path):
    stt_service = WhisperSTTService(whisper_path, model_path)

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
