#!/bin/bash

# Test script for nginx configuration
# This script tests the nginx configuration without running the full container

set -e

echo "🧪 Testing Nginx Configuration"
echo "=============================="

# Test nginx configuration syntax
echo "1. Testing nginx configuration syntax..."
nginx -t -c /Users/alo/geistai/backend/nginx/conf/nginx.conf

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration syntax is valid"
else
    echo "❌ Nginx configuration syntax is invalid"
    exit 1
fi

echo ""
echo "2. Configuration summary:"
echo "   - HTTP server (port 80): Redirects to HTTPS except /health"
echo "   - HTTPS server (port 443): Full proxy functionality"
echo "   - Self-signed certificates will be auto-generated if missing"
echo "   - Upstream: host.docker.internal:8080"

echo ""
echo "✅ Configuration test completed successfully!"
echo ""
echo "🚀 To deploy:"
echo "   1. Build and run the nginx container"
echo "   2. Ensure inference service is running on port 8080"
echo "   3. Test with: curl -k https://inference.geist.im/health"
