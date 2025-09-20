"""
Speech-to-Text Service using Whisper.cpp
"""
import subprocess
import tempfile
import os
import logging
from typing import Optional, Dict, Any
import json

logger = logging.getLogger(__name__)

class STTService:
    def __init__(self, whisper_path: str, model_path: str):
        self.whisper_path = whisper_path
        self.model_path = model_path
        self.language = "auto"  # Auto-detect language

    def transcribe_audio(self, audio_data: bytes, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio data using Whisper.cpp

        Args:
            audio_data: Raw audio bytes
            language: Language code (e.g., 'en', 'es', 'fr') or None for auto-detect

        Returns:
            Dict containing transcription results
        """
        try:
            # Create temporary file for audio data (WAV format from expo-audio)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_audio_path = temp_file.name

            # Use whisper-cli (new binary) instead of deprecated main
            whisper_cli_path = self.whisper_path.replace('main', 'whisper-cli')

            # Prepare whisper command
            cmd = [
                whisper_cli_path,
                "-m", self.model_path,
                "-f", temp_audio_path,
                "--no-timestamps",
                "--print-progress", "false",
                "--print-colors", "false",
                "--no-prints"
            ]

            # Add language if specified
            if language:
                cmd.extend(["-l", language])
            else:
                cmd.extend(["-l", self.language])

            logger.info(f"Running whisper command: {' '.join(cmd)}")

            # Run whisper.cpp
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60  # 60 second timeout
            )

            # Clean up temporary files
            try:
                os.unlink(temp_audio_path)
            except OSError:
                pass

            if result.returncode != 0:
                logger.error(f"Whisper failed with return code {result.returncode}")
                logger.error(f"Stderr: {result.stderr}")
                logger.error(f"Stdout: {result.stdout}")
                return {
                    "success": False,
                    "error": f"Transcription failed: {result.stderr}",
                    "text": ""
                }

            # Parse output - whisper outputs text directly to stdout
            try:
                # Clean the output by removing ANSI color codes and extra whitespace
                text = result.stdout.strip()

                # Remove ANSI color codes if present
                import re
                text = re.sub(r'\x1b\[[0-9;]*m', '', text)
                text = text.strip()

                if not text:
                    logger.warning(f"No transcription output received")
                    return {
                        "success": False,
                        "text": "",
                        "error": "No transcription output received",
                        "language": language or "auto"
                    }

                return {
                    "success": True,
                    "text": text,
                    "language": language or "auto",
                    "confidence": 1.0  # Whisper doesn't provide confidence scores in text mode
                }

            except Exception as e:
                logger.error(f"Failed to parse whisper output: {e}")
                logger.error(f"Raw output: {result.stdout}")
                return {
                    "success": False,
                    "error": f"Failed to parse transcription output: {e}",
                    "text": ""
                }

        except subprocess.TimeoutExpired:
            logger.error("Whisper transcription timed out")
            return {
                "success": False,
                "error": "Transcription timed out",
                "text": ""
            }
        except Exception as e:
            logger.error(f"Unexpected error in transcription: {e}")
            return {
                "success": False,
                "error": f"Unexpected error: {e}",
                "text": ""
            }

    def transcribe_file(self, file_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio file using Whisper.cpp

        Args:
            file_path: Path to audio file
            language: Language code or None for auto-detect

        Returns:
            Dict containing transcription results
        """
        try:
            # Read audio file
            with open(file_path, 'rb') as f:
                audio_data = f.read()

            return self.transcribe_audio(audio_data, language)

        except Exception as e:
            logger.error(f"Failed to read audio file {file_path}: {e}")
            return {
                "success": False,
                "error": f"Failed to read audio file: {e}",
                "text": ""
            }
