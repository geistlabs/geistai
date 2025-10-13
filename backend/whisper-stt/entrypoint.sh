#!/bin/bash
set -e

echo "============================================================"
echo "WHISPER STT SERVICE - SYSTEM INFO"
echo "============================================================"
echo "Platform: $(uname -s) $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Python: $(python --version 2>&1 | cut -d' ' -f2)"

# Check for NVIDIA GPU
if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>/dev/null | grep -q .; then
        echo "GPU: NVIDIA GPU DETECTED"
        nvidia-smi --query-gpu=name,driver_version --format=csv,noheader | while IFS=, read -r name driver; do
            echo "  - $name (Driver:$driver)"
        done
    else
        echo "GPU: No NVIDIA GPU detected (CPU-only mode)"
    fi
else
    echo "GPU: No NVIDIA GPU detected (CPU-only mode)"
fi

echo "Whisper Binary: ${WHISPER_BINARY_PATH:-/usr/local/bin/whisper-cli}"
echo "Whisper Model: ${WHISPER_MODEL_PATH:-/models/ggml-base.bin}"
echo "============================================================"

# Start the application
exec python main.py

