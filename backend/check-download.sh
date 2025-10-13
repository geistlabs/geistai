#!/bin/bash

# Monitor Qwen download progress

MODEL_FILE="/Users/alexmartinez/openq-ws/geistai/backend/inference/models/qwen2.5-coder-32b-instruct-q4_k_m.gguf"
LOG_FILE="/tmp/qwen_download.log"
EXPECTED_SIZE="18GB"

echo "🔍 Qwen 2.5 32B Download Monitor"
echo "=================================="
echo ""

if [ -f "$MODEL_FILE" ]; then
    CURRENT_SIZE=$(ls -lh "$MODEL_FILE" | awk '{print $5}')
    echo "✅ File exists: $CURRENT_SIZE / ~$EXPECTED_SIZE"
    echo ""

    # Check if complete (file should be ~18GB)
    SIZE_BYTES=$(stat -f%z "$MODEL_FILE" 2>/dev/null || stat -c%s "$MODEL_FILE" 2>/dev/null)
    if [ "$SIZE_BYTES" -gt 17000000000 ]; then
        echo "🎉 Download complete!"
        echo ""
        echo "Next steps:"
        echo "  cd /Users/alexmartinez/openq-ws/geistai/backend"
        echo "  ./start-local-dev.sh"
    else
        echo "⏳ Still downloading..."
        echo ""
        echo "📊 Live progress:"
        tail -3 "$LOG_FILE"
    fi
else
    echo "⏳ Download starting..."
    if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "📊 Progress:"
        tail -3 "$LOG_FILE"
    fi
fi

echo ""
echo "To monitor: watch -n 2 ./check-download.sh"
