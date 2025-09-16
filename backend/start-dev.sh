#!/bin/bash

# Development startup script for GeistAI backend services
# This script provides live reloading for rapid development

set -e

echo "🚀 Starting GeistAI backend services in development mode..."
echo "📝 Live reloading enabled for router and embeddings services"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    docker compose down
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build and start services
echo -e "${BLUE}🔨 Building services...${NC}"
docker compose build

echo -e "${BLUE}🏃 Starting services with live reload...${NC}"
docker compose up --remove-orphans

# All development settings are now in docker-compose.yml
echo ""
echo -e "${GREEN}✅ Services started successfully!${NC}"
echo ""
echo "📡 Available endpoints:"
echo "  - Router (HTTP):  http://localhost:8000"
echo "  - Router (HTTPS): https://localhost:8443 (if SSL enabled)"
echo "  - Embedder:       http://localhost:8001"
echo "  - Inference:      http://localhost:8080"
echo ""
echo "🔄 Live reload is enabled for:"
echo "  - Router service (./router/ directory)"
echo "  - Embeddings service (./embeddings/ directory)"
echo ""
echo "💡 Tips:"
echo "  - Edit files in ./router/ or ./embeddings/ to see live changes"
echo "  - Use Ctrl+C to stop all services"
echo "  - Check logs with: docker compose logs -f [service-name]"
echo ""
echo -e "${YELLOW}📊 Monitoring logs... (Press Ctrl+C to stop)${NC}"

# Keep script running and show logs
docker compose logs -f
