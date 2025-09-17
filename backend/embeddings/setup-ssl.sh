#!/bin/bash

# SSL Setup Script for Embedder Service
# This script helps you set up SSL certificates for the embeddings service

set -e

CERT_DIR="/home/alo/geistai/backend/embeddings/certificates"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔐 SSL Setup for Embedder Service"
echo "================================="

# Check if certificates directory exists
if [ ! -d "$CERT_DIR" ]; then
    echo "Creating certificates directory..."
    mkdir -p "$CERT_DIR"
fi

echo ""
echo "📁 Certificate files should be placed in: $CERT_DIR"
echo ""
echo "Required files:"
echo "  - cert.pem (your SSL certificate)"
echo "  - key.pem (your SSL private key)"
echo ""

# Check if certificate files exist
if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ]; then
    echo "✅ Certificate files found!"
    
    # Set proper permissions
    echo "Setting proper file permissions..."
    chmod 644 "$CERT_DIR/cert.pem"
    chmod 600 "$CERT_DIR/key.pem"
    
    echo "✅ File permissions set correctly"
    
    # Validate certificate files
    echo ""
    echo "🔍 Validating certificate files..."
    
    # Check certificate format
    if grep -q "BEGIN CERTIFICATE" "$CERT_DIR/cert.pem"; then
        echo "✅ Certificate format is valid"
    else
        echo "❌ Certificate format appears invalid"
    fi
    
    # Check private key format
    if grep -q "BEGIN.*PRIVATE KEY" "$CERT_DIR/key.pem"; then
        echo "✅ Private key format is valid"
    else
        echo "❌ Private key format appears invalid"
    fi
    
    # Check key permissions
    KEY_PERMS=$(stat -c "%a" "$CERT_DIR/key.pem")
    if [ "$KEY_PERMS" = "600" ]; then
        echo "✅ Private key permissions are secure (600)"
    else
        echo "⚠️  Private key permissions are $KEY_PERMS (should be 600)"
    fi
    
    echo ""
    echo "🚀 To enable SSL, run the embeddings with SSL configuration:"
    echo "   docker run -d \\"
    echo "     --name embeddings-server \\"
    echo "     -p 80:8001 \\"
    echo "     -p 443:8443 \\"
    echo "     -e SSL_ENABLED=true \\"
    echo "     -e SSL_CERT_PATH=/app/certificates/cert.pem \\"
    echo "     -e SSL_KEY_PATH=/app/certificates/key.pem \\"
    echo "     -e API_PORT=8443 \\"
    echo "     -v embeddings-models:/app/models \\"
    echo "     -v $CERT_DIR:/app/certificates:ro \\"
    echo "     alo42/embeddings:latest"
    echo ""
    echo "🧪 Test the SSL setup with:"
    echo "   python3 $SCRIPT_DIR/test-ssl.py"
    
else
    echo "❌ Certificate files not found!"
    echo ""
    echo "Please place your certificate files in the certificates directory:"
    echo "   cp your-cert.pem $CERT_DIR/cert.pem"
    echo "   cp your-key.pem $CERT_DIR/key.pem"
    echo ""
    echo "Then run this script again."
    echo ""
    echo "💡 If you need to generate a test certificate, you can use:"
    echo "   openssl req -x509 -newkey rsa:2048 -keyout $CERT_DIR/key.pem -out $CERT_DIR/cert.pem -days 365 -nodes -subj '/CN=embeddings.geist.im'"
fi

echo ""
echo "📖 For more information, see: $CERT_DIR/README.md"
