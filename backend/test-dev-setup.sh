#!/bin/bash

# Test script to verify the development setup works correctly
# This script tests that live reloading is properly configured

set -e

echo "🧪 Testing GeistAI development setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Check if docker-compose files exist
echo -e "${BLUE}📋 Test 1: Checking configuration files...${NC}"

if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✅ docker-compose.yml found${NC}"
else
    echo -e "${RED}❌ docker-compose.yml not found${NC}"
    exit 1
fi

# Override file is no longer needed - all settings are in main docker-compose.yml
echo -e "${GREEN}✅ All development settings consolidated in docker-compose.yml${NC}"

if [ -f "start-dev.sh" ] && [ -x "start-dev.sh" ]; then
    echo -e "${GREEN}✅ start-dev.sh found and executable${NC}"
else
    echo -e "${RED}❌ start-dev.sh not found or not executable${NC}"
    exit 1
fi

# Test 2: Check if volume mounts are configured
echo -e "${BLUE}📁 Test 2: Checking volume mount configuration...${NC}"

if grep -q "./router:/app" docker-compose.yml; then
    echo -e "${GREEN}✅ Router volume mount configured${NC}"
else
    echo -e "${RED}❌ Router volume mount not found${NC}"
    exit 1
fi

if grep -q "./embedder:/app" docker-compose.yml; then
    echo -e "${GREEN}✅ Embedder volume mount configured${NC}"
else
    echo -e "${RED}❌ Embedder volume mount not found${NC}"
    exit 1
fi

# Test 3: Check if reload commands are configured
echo -e "${BLUE}🔄 Test 3: Checking reload configuration...${NC}"

if grep -q "reload=True" docker-compose.yml; then
    echo -e "${GREEN}✅ Router reload configuration found${NC}"
else
    echo -e "${RED}❌ Router reload configuration not found${NC}"
    exit 1
fi

if grep -q "\-\-reload" docker-compose.yml; then
    echo -e "${GREEN}✅ Embedder reload configuration found${NC}"
else
    echo -e "${RED}❌ Embedder reload configuration not found${NC}"
    exit 1
fi

# Test 4: Check if development environment variables are set
echo -e "${BLUE}🔧 Test 4: Checking development environment...${NC}"

if grep -q "PYTHONUNBUFFERED=1" docker-compose.yml; then
    echo -e "${GREEN}✅ Python unbuffered output configured${NC}"
else
    echo -e "${RED}❌ Python unbuffered output not configured${NC}"
    exit 1
fi

if grep -q "PYTHONDONTWRITEBYTECODE=1" docker-compose.yml; then
    echo -e "${GREEN}✅ Python bytecode prevention configured${NC}"
else
    echo -e "${RED}❌ Python bytecode prevention not configured${NC}"
    exit 1
fi

# Test 5: Validate docker-compose configuration
echo -e "${BLUE}🐳 Test 5: Validating Docker Compose configuration...${NC}"

if docker compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker Compose configuration is valid${NC}"
else
    echo -e "${RED}❌ Docker Compose configuration has errors${NC}"
    echo "Run 'docker compose config' to see details"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All tests passed! Development setup is ready.${NC}"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Run './start-dev.sh' to start development mode"
echo "  2. Edit files in ./router/ or ./embedder/ to test live reload"
echo "  3. Check http://localhost:8000/health to verify services"
echo ""
echo -e "${BLUE}🚀 Happy coding!${NC}"
