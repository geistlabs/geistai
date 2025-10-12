#!/bin/bash

echo "🧪 Analyzing Harmony Format Artifacts"
echo "======================================"
echo ""

# Test 1: Weather query (tool-based)
echo "Test 1: Weather in Paris (Tool Query)"
echo "--------------------------------------"
curl -s -N http://localhost:8000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is the weather in Paris?"}' \
  -m 30 2>&1 > /tmp/harmony_test1.txt

# Extract just the response content
cat /tmp/harmony_test1.txt | grep 'data:' | grep -v 'ping' | head -1 | \
  sed 's/.*"token": "\(.*\)", "sequence".*/\1/' | \
  sed 's/\\n/\n/g' | \
  sed 's/\\"/"/g'

echo ""
echo ""
sleep 2

# Test 2: Simple creative query
echo "Test 2: Tell me a joke (Creative Query - Direct GPT-OSS)"
echo "---------------------------------------------------------"
curl -s -N http://localhost:8000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"Tell me a programming joke"}' \
  -m 10 2>&1 > /tmp/harmony_test2.txt

cat /tmp/harmony_test2.txt | grep 'data:' | grep -v 'ping' | head -10 | \
  sed 's/.*"token": "\(.*\)", "sequence".*/\1/' | tr -d '\n'

echo ""
echo ""
sleep 2

# Test 3: Simple knowledge query
echo "Test 3: What is Docker? (Knowledge Query - Direct GPT-OSS)"
echo "-----------------------------------------------------------"
curl -s -N http://localhost:8000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is Docker?"}' \
  -m 10 2>&1 > /tmp/harmony_test3.txt

cat /tmp/harmony_test3.txt | grep 'data:' | grep -v 'ping' | head -10 | \
  sed 's/.*"token": "\(.*\)", "sequence".*/\1/' | tr -d '\n'

echo ""
echo ""
echo "======================================"
echo "Raw files saved:"
echo "  /tmp/harmony_test1.txt (Weather)"
echo "  /tmp/harmony_test2.txt (Joke)"
echo "  /tmp/harmony_test3.txt (Docker)"
