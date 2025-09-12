#!/bin/bash

# SSL Setup Script for Nginx Reverse Proxy
# This script helps you set up SSL certificates for both inference and embedder services

set -e

CERT_DIR="/home/alo/geistai/backend/nginx/certificates"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔐 SSL Setup for Nginx Reverse Proxy"
echo "===================================="

# Check if certificates directory exists
if [ ! -d "$CERT_DIR" ]; then
    echo "Creating certificates directory..."
    mkdir -p "$CERT_DIR"
fi

echo ""
echo "📁 Certificate files should be placed in: $CERT_DIR"
echo ""
echo "Required files for SSL:"
echo "  - cert.pem (SSL certificate for inference.geist.im)"
echo "  - key.pem (SSL private key for inference.geist.im)"
echo ""

# Check certificate files
INFERENCE_CERT_EXISTS=false
EMBEDDER_CERT_EXISTS=false

if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ]; then
    echo "✅ SSL certificates found!"
    INFERENCE_CERT_EXISTS=true
    
    # Set proper permissions
    chmod 644 "$CERT_DIR/cert.pem"
    chmod 600 "$CERT_DIR/key.pem"
else
    echo "❌ SSL certificates not found"
fi

if [ -f "$CERT_DIR/embedder-cert.pem" ] && [ -f "$CERT_DIR/embedder-key.pem" ]; then
    echo "✅ Embedder SSL certificates found!"
    EMBEDDER_CERT_EXISTS=true
    
    # Set proper permissions
    chmod 644 "$CERT_DIR/embedder-cert.pem"
    chmod 600 "$CERT_DIR/embedder-key.pem"
else
    echo "❌ Embedder SSL certificates not found"
fi

if [ "$INFERENCE_CERT_EXISTS" = true ] && [ "$EMBEDDER_CERT_EXISTS" = true ]; then
    echo ""
    echo "🚀 To enable SSL for both services, run:"
    echo "   docker run -d \\"
    echo "     --name nginx-proxy \\"
    echo "     -p 80:80 \\"
    echo "     -p 443:443 \\"
    echo "     -e SSL_ENABLED=true \\"
    echo "     -e INFERENCE_HOST=inference-server \\"
    echo "     -e EMBEDDER_HOST=embedder-server \\"
    echo "     -v $CERT_DIR:/app/certificates:ro \\"
    echo "     alo42/nginx:latest"
    echo ""
    echo "🧪 Test the SSL setup with:"
    echo "   python3 $SCRIPT_DIR/test-ssl.py"
    
elif [ "$INFERENCE_CERT_EXISTS" = true ] || [ "$EMBEDDER_CERT_EXISTS" = true ]; then
    echo ""
    echo "⚠️  Only partial SSL certificates found"
    echo "   You can run with HTTP mode, but HTTPS will only work for services with certificates"
    
else
    echo ""
    echo "📖 To set up certificates:"
    echo ""
    echo "For inference.geist.im:"
    echo "   cp your-cert.pem $CERT_DIR/cert.pem"
    echo "   cp your-key.pem $CERT_DIR/key.pem"
    echo ""
    echo "💡 Or generate test certificates:"
    echo "   openssl req -x509 -newkey rsa:2048 -keyout $CERT_DIR/key.pem -out $CERT_DIR/cert.pem -days 365 -nodes -subj '/CN=inference.geist.im'"
fi

echo ""
echo "🏗️  Architecture:"
echo "   Client → nginx (SSL termination) → Backend Services (HTTP)"
echo "   - nginx: ports 80 (HTTP) and 443 (HTTPS)"
echo "   - Routes inference.geist.im → inference-server:8080"
echo "   - Routes embedder.geist.im → embedder-server:8001"
