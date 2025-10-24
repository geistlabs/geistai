#!/bin/bash

# GBNF Schema Validator Script
# This script validates the memory schema.gbnf file

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLAMA_DIR="$SCRIPT_DIR/../llama.cpp"
VALIDATOR="$LLAMA_DIR/build/bin/test-gbnf-validator"
SCHEMA_FILE="$SCRIPT_DIR/schema.gbnf"
TEST_INPUT="$SCRIPT_DIR/test_input.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 GBNF Schema Validator${NC}"
echo "=================================="

# Check if validator exists
if [[ ! -f "$VALIDATOR" ]]; then
    echo -e "${RED}❌ Validator not found at: $VALIDATOR${NC}"
    echo -e "${YELLOW}💡 Make sure llama.cpp is built with: cmake --build build --config Release${NC}"
    exit 1
fi

# Check if schema file exists
if [[ ! -f "$SCHEMA_FILE" ]]; then
    echo -e "${RED}❌ Schema file not found at: $SCHEMA_FILE${NC}"
    exit 1
fi

# Check if test input exists or is empty
if [[ ! -f "$TEST_INPUT" ]] || [[ ! -s "$TEST_INPUT" ]]; then
    echo -e "${YELLOW}⚠️  Creating test input file...${NC}"
    cat > "$TEST_INPUT" << 'EOF'
[{"content": "This is a test memory", "category": "personal", "relevanceScore": 0.8, "originalContext": "User mentioned this during conversation"}]
EOF
fi

echo -e "${BLUE}📄 Validating schema: $(basename "$SCHEMA_FILE")${NC}"
echo -e "${BLUE}🧪 Using test input: $(basename "$TEST_INPUT")${NC}"
echo ""

# Set library path and run validator
cd "$LLAMA_DIR"
export DYLD_LIBRARY_PATH="$(pwd)/build/bin:$DYLD_LIBRARY_PATH"

echo ""
echo "Running validation..."
echo ""

# Capture both stdout and stderr, and the exit code
VALIDATION_OUTPUT=$(./build/bin/test-gbnf-validator "../memory/schema.gbnf" "../memory/test_input.txt" 2>&1)
VALIDATION_EXIT_CODE=$?

echo "$VALIDATION_OUTPUT"

if [ $VALIDATION_EXIT_CODE -eq 0 ] && echo "$VALIDATION_OUTPUT" | grep -q "Input string is valid"; then
    echo ""
    echo -e "${GREEN}✅ Grammar validation PASSED!${NC}"
    echo -e "${GREEN}   Your schema.gbnf is syntactically correct and can parse the test input.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Grammar validation FAILED!${NC}"
    echo -e "${YELLOW}💡 Check the error message above for details on what needs to be fixed.${NC}"
    exit 1
fi
