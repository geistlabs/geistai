#!/bin/bash

# Analysis script for test results
TEST_DIR="test_logs_20251015_192815"

echo "========================================"
echo "  Test Results Analysis"
echo "========================================"
echo ""

# Questions array
declare -a QUESTIONS=(
    "What is the current weather in London?"
    "What are the latest news headlines about artificial intelligence?"
    "Who is the current Prime Minister of the United Kingdom?"
    "What is the current weather in Sydney?"
)

for i in {1..4}; do
    echo "----------------------------------------"
    echo "TEST $i: ${QUESTIONS[$((i-1))]}"
    echo "----------------------------------------"
    
    # Count actual tool calls (divide by 2 because each call is logged twice)
    tool_calls=$(grep "🔍 agent_name: main_orchestrator calling tool:" "$TEST_DIR/test_${i}_docker.log" | wc -l | tr -d ' ')
    
    echo "Tool Calls: $tool_calls"
    
    # Show which tools were called
    echo "Tools Used:"
    grep "🔍 agent_name: main_orchestrator calling tool:" "$TEST_DIR/test_${i}_docker.log" | \
        sed 's/.*calling tool: /  - /' | sed 's/ with arguments.*//'
    
    # Check if hit context limit
    if grep -q "Context limit\|context.*exceed" "$TEST_DIR/test_${i}_docker.log"; then
        echo "⚠️  WARNING: Context limit hit!"
    fi
    
    # Check for errors
    if grep -q "❌\|ERROR\|Error executing" "$TEST_DIR/test_${i}_docker.log"; then
        echo "❌ ERRORS FOUND"
        grep "❌\|ERROR" "$TEST_DIR/test_${i}_docker.log" | head -3
    else
        echo "✅ No errors"
    fi
    
    # Get completion status
    if grep -q "normal completion" "$TEST_DIR/test_${i}_docker.log"; then
        echo "✅ Completed normally"
    fi
    
    # Extract a sample of the response
    echo ""
    echo "Response Preview:"
    grep '"content":"[^"]*"' "$TEST_DIR/test_${i}_response.txt" | \
        grep "orchestrator_token" | head -20 | \
        sed 's/.*"content":"\([^"]*\)".*/\1/' | tr -d '\n' | fold -w 80 | head -3
    
    echo ""
    echo ""
done

echo "========================================"
echo "  Final Tool Statistics"
echo "========================================"
curl -s http://localhost:8000/api/tools/stats | python3 -m json.tool
echo ""

