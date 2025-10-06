"""
Standalone Whisper STT Service
FastAPI service for speech-to-text using whisper.cpp
"""

import os
import tempfile
import subprocess
import json
import logging
from typing import Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Whisper STT Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def detect_gpu_info():
    """Detect GPU information and capabilities"""
    gpu_info = {
        "cuda_available": False,
        "gpu_count": 0,
        "gpu_devices": [],
        "cuda_version": None,
        "compute_capability": []
    }
    
    try:
        # Check if nvidia-smi is available
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,compute_cap,driver_version', '--format=csv,noheader,nounits'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            gpu_info["cuda_available"] = True
            lines = result.stdout.strip().split('\n')
            gpu_info["gpu_count"] = len(lines)
            
            for i, line in enumerate(lines):
                parts = line.split(', ')
                if len(parts) >= 3:
                    name, compute_cap, driver = parts[0], parts[1], parts[2]
                    gpu_info["gpu_devices"].append({
                        "index": i,
                        "name": name,
                        "compute_capability": compute_cap,
                        "driver_version": driver
                    })
                    gpu_info["compute_capability"].append(compute_cap)
        
        # Try to get CUDA version
        try:
            result = subprocess.run(['nvcc', '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'release' in line.lower():
                        gpu_info["cuda_version"] = line.strip()
                        break
        except:
            pass
            
    except Exception as e:
        logger.warning(f"GPU detection failed: {e}")
    
    return gpu_info

def get_system_info():
    """Get system information"""
    import platform
    import multiprocessing
    
    return {
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "cpu_count": multiprocessing.cpu_count(),
        "architecture": platform.machine(),
        "processor": platform.processor()
    }

class WhisperSTTService:
    def __init__(self, whisper_path: str, model_path: str):
        self.whisper_path = whisper_path
        self.model_path = model_path
        self.gpu_info = detect_gpu_info()
        self.system_info = get_system_info()
        
        # Log system information
        self._log_startup_info()
    
    def _log_startup_info(self):
        """Log detailed startup information"""
        logger.info("=" * 60)
        logger.info("WHISPER STT SERVICE STARTUP")
        logger.info("=" * 60)
        
        # System info
        logger.info(f"Platform: {self.system_info['platform']}")
        logger.info(f"Python: {self.system_info['python_version']}")
        logger.info(f"CPU Cores: {self.system_info['cpu_count']}")
        logger.info(f"Architecture: {self.system_info['architecture']}")
        
        # GPU info
        if self.gpu_info["cuda_available"]:
            logger.info("🎯 GPU DETECTION SUCCESSFUL")
            logger.info(f"CUDA Available: {self.gpu_info['cuda_available']}")
            logger.info(f"GPU Count: {self.gpu_info['gpu_count']}")
            
            for i, gpu in enumerate(self.gpu_info["gpu_devices"]):
                logger.info(f"  Device {gpu['index']}: {gpu['name']}")
                logger.info(f"    Compute Capability: {gpu['compute_capability']}")
                logger.info(f"    Driver Version: {gpu['driver_version']}")
            
            if self.gpu_info["cuda_version"]:
                logger.info(f"CUDA Version: {self.gpu_info['cuda_version']}")
        else:
            logger.warning("⚠️  GPU DETECTION FAILED - Running on CPU only")
            logger.warning("   This may result in slower transcription performance")
        
        # Whisper binary info
        logger.info(f"Whisper Binary: {self.whisper_path}")
        logger.info(f"Model Path: {self.model_path}")
        
        # Test whisper binary
        try:
            result = subprocess.run([self.whisper_path, '--help'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                logger.info("✅ Whisper binary is functional")
            else:
                logger.error(f"❌ Whisper binary test failed: {result.stderr}")
        except Exception as e:
            logger.error(f"❌ Whisper binary test error: {e}")
        
        logger.info("=" * 60)

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

                # Add GPU acceleration if available
                if self.gpu_info["cuda_available"]:
                    cmd.extend(["--gpu-layers", "32"])  # Use GPU for acceleration
                    logger.info("🚀 Using GPU acceleration for transcription")
                else:
                    logger.info("💻 Using CPU-only transcription")

                # Add language if specified
                if language:
                    cmd.extend(["-l", language])

                # Add output format (JSON)
                cmd.extend(["-oj"])

                # Log the command being executed
                logger.info(f"Executing whisper command: {' '.join(cmd[:4])}...")
                
                # Run whisper
                import time
                start_time = time.time()
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                end_time = time.time()
                
                logger.info(f"Transcription completed in {end_time - start_time:.2f} seconds")

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

# Initialize STT service
whisper_path = os.getenv("WHISPER_BINARY_PATH", "/usr/local/bin/whisper-cli")
model_path = os.getenv("WHISPER_MODEL_PATH", "/models/ggml-base.bin")

stt_service = None
if os.path.exists(whisper_path) and os.path.exists(model_path):
    stt_service = WhisperSTTService(whisper_path, model_path)
    logger.info("✅ Whisper STT service initialized successfully")
else:
    logger.error("❌ Whisper STT service not available")
    logger.error(f"   Binary exists: {os.path.exists(whisper_path)}")
    logger.error(f"   Model exists: {os.path.exists(model_path)}")
    logger.error(f"   Binary path: {whisper_path}")
    logger.error(f"   Model path: {model_path}")

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
    info = {
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
    
    # Add GPU and system info if service is available
    if stt_service:
        info["gpu_info"] = stt_service.gpu_info
        info["system_info"] = stt_service.system_info
    
    return info

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8004))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
