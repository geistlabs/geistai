#!/bin/bash

# Comprehensive Test Suite for GeistAI
# Tests various types of queries: weather, news, facts, current events, etc.
# Date: October 16, 2025

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:8000/api/stream"
STATS_URL="http://localhost:8000/api/tools/stats"
LOG_DIR="./test_logs_$(date +%Y%m%d_%H%M%S)"
TIMEOUT=90

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  GeistAI Comprehensive Test Suite  ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "Log Directory: ${YELLOW}$LOG_DIR${NC}"
echo ""

# Array of test questions
declare -a QUESTIONS=(
    "What is the current weather in London?"
    "What are the latest news headlines about artificial intelligence?"
    "Who is the current Prime Minister of the United Kingdom?"
    "What is the current weather in Sydney?"
    "What are the latest developments in climate change?"
    "Who won the last FIFA World Cup?"
    "What is the current weather in New York City?"
    "What are the top tech news stories today?"
    "Who is the current President of France?"
    "What is the current weather in Mumbai?"
)

# Function to run a single test
run_test() {
    local question_num=$1
    local question=$2
    local log_file="$LOG_DIR/test_${question_num}_query.log"
    local response_file="$LOG_DIR/test_${question_num}_response.txt"
    local docker_log_file="$LOG_DIR/test_${question_num}_docker.log"

    echo -e "${GREEN}[Test $question_num/10]${NC} ${YELLOW}Question:${NC} $question"
    echo ""

    # Log the question
    echo "Question: $question" > "$log_file"
    echo "Timestamp: $(date)" >> "$log_file"
    echo "===========================================" >> "$log_file"
    echo "" >> "$log_file"

    # Capture tool stats before the test
    echo "Tool Stats BEFORE:" >> "$log_file"
    curl -s "$STATS_URL" >> "$log_file" 2>&1
    echo "" >> "$log_file"
    echo "===========================================" >> "$log_file"
    echo "" >> "$log_file"

    # Run the query with timeout (use gtimeout on macOS)
    echo -e "  ${BLUE}→${NC} Sending query..."
    gtimeout $TIMEOUT curl -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$question\"}" \
        --no-buffer 2>&1 | tee -a "$log_file" > "$response_file"

    local curl_exit_code=${PIPESTATUS[0]}

    echo "" >> "$log_file"
    echo "===========================================" >> "$log_file"
    echo "" >> "$log_file"

    # Capture Docker logs (run from test directory, navigate to backend)
    echo "Docker Logs:" >> "$log_file"
    (cd backend && docker compose logs router-local --tail=50) > "$docker_log_file" 2>&1
    cat "$docker_log_file" >> "$log_file"

    echo "" >> "$log_file"
    echo "===========================================" >> "$log_file"
    echo "" >> "$log_file"

    # Capture tool stats after the test
    echo "Tool Stats AFTER:" >> "$log_file"
    curl -s "$STATS_URL" >> "$log_file" 2>&1
    echo "" >> "$log_file"

    # Extract tool calls count from Docker logs
    local tool_calls=$(grep -c "calling tool:" "$docker_log_file" 2>/dev/null || echo "0")

    # Extract response summary
    local response_preview=$(grep -o '"content":"[^"]*"' "$response_file" | head -5 | cut -d'"' -f4 | tr '\n' ' ' | head -c 100)

    # Check if test completed successfully
    if [ $curl_exit_code -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} Test completed successfully"
    elif [ $curl_exit_code -eq 124 ]; then
        echo -e "  ${RED}✗${NC} Test timed out after ${TIMEOUT}s"
    else
        echo -e "  ${RED}✗${NC} Test failed with exit code $curl_exit_code"
    fi

    echo -e "  ${BLUE}→${NC} Tool calls made: ${tool_calls}"
    echo -e "  ${BLUE}→${NC} Response preview: ${response_preview}..."
    echo ""
    echo -e "${BLUE}─────────────────────────────────────${NC}"
    echo ""

    # Brief pause between tests
    sleep 3
}

# Main test execution
echo -e "${YELLOW}Starting test suite...${NC}"
echo ""

for i in "${!QUESTIONS[@]}"; do
    question_num=$((i + 1))
    run_test "$question_num" "${QUESTIONS[$i]}"
done

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  All Tests Completed!              ${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Generate summary report
SUMMARY_FILE="$LOG_DIR/00_SUMMARY.txt"

echo "GeistAI Test Suite Summary" > "$SUMMARY_FILE"
echo "=========================" >> "$SUMMARY_FILE"
echo "Date: $(date)" >> "$SUMMARY_FILE"
echo "Total Tests: 10" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

echo "Test Results:" >> "$SUMMARY_FILE"
echo "-------------" >> "$SUMMARY_FILE"
for i in "${!QUESTIONS[@]}"; do
    question_num=$((i + 1))
    question="${QUESTIONS[$i]}"
    log_file="$LOG_DIR/test_${question_num}_query.log"
    docker_log_file="$LOG_DIR/test_${question_num}_docker.log"

    # Count tool calls
    tool_calls=$(grep -c "calling tool:" "$docker_log_file" 2>/dev/null || echo "0")

    # Check for errors
    if grep -q "error\|Error\|ERROR" "$log_file"; then
        status="❌ FAILED"
    else
        status="✅ PASSED"
    fi

    echo "" >> "$SUMMARY_FILE"
    echo "Test $question_num: $status" >> "$SUMMARY_FILE"
    echo "  Question: $question" >> "$SUMMARY_FILE"
    echo "  Tool Calls: $tool_calls" >> "$SUMMARY_FILE"
done

echo "" >> "$SUMMARY_FILE"
echo "Final Tool Statistics:" >> "$SUMMARY_FILE"
echo "---------------------" >> "$SUMMARY_FILE"
curl -s "$STATS_URL" | python3 -m json.tool >> "$SUMMARY_FILE" 2>&1

echo ""
echo -e "${BLUE}Summary Report:${NC} $SUMMARY_FILE"
echo -e "${BLUE}All Logs:${NC} $LOG_DIR"
echo ""

# Display summary
cat "$SUMMARY_FILE"

echo ""
echo -e "${GREEN}✓ Test suite complete!${NC}"
echo ""
