#!/bin/sh

# Startup script for nginx SSL-terminating reverse proxy
# This script configures nginx based on SSL settings and available certificates

set -e

echo "🌐 Starting Geist Nginx Reverse Proxy"
echo "====================================="

# Environment variables
SSL_ENABLED=${SSL_ENABLED:-false}
INFERENCE_HOST=${INFERENCE_HOST:-host.docker.internal}

# Certificate paths - support both naming conventions
INFERENCE_CERT=${INFERENCE_CERT_PATH:-${SSL_CERT_PATH:-/app/certificates/cert.pem}}
INFERENCE_KEY=${INFERENCE_KEY_PATH:-${SSL_KEY_PATH:-/app/certificates/key.pem}}

echo "🔧 Configuration:"
echo "   SSL Enabled: $SSL_ENABLED"
echo "   Inference Host: $INFERENCE_HOST"

if [ "$SSL_ENABLED" = "true" ]; then
    echo "🔐 SSL Mode: Enabled"
    
    # Check inference certificates
    if [ -f "$INFERENCE_CERT" ] && [ -f "$INFERENCE_KEY" ]; then
        echo "✅ Inference SSL certificates found"
    else
        echo "⚠️  Inference SSL certificates not found"
        echo "   Expected: $INFERENCE_CERT and $INFERENCE_KEY"
    fi
    
else
    echo "📡 SSL Mode: Disabled (HTTP only)"
fi

# Update nginx configuration with environment variables
echo ""
echo "🔧 Updating nginx configuration..."

# Replace upstream server hostnames in nginx.conf
sed -i "s/host.docker.internal:8080/$INFERENCE_HOST:8080/g" /etc/nginx/nginx.conf

# Handle SSL configuration conditionally
if [ "$SSL_ENABLED" = "true" ]; then
    # Check if SSL certificates exist
    if [ ! -f "$INFERENCE_CERT" ] || [ ! -f "$INFERENCE_KEY" ]; then
        echo "❌ SSL enabled but certificates not found. Disabling HTTPS server block."
        # Comment out the HTTPS server block if certificates are missing
        sed -i '/# HTTPS server for inference.geist.im/,/^    }$/s/^/#/' /etc/nginx/nginx.conf
    else
        echo "✅ SSL certificates found. HTTPS server block enabled."
    fi
else
    echo "📡 SSL disabled. Checking for certificates anyway..."
    # Check if certificates exist, if not create self-signed ones
    if [ ! -f "$INFERENCE_CERT" ] || [ ! -f "$INFERENCE_KEY" ]; then
        echo "🔧 Creating self-signed certificates for HTTPS fallback..."
        mkdir -p /app/certificates
        openssl req -x509 -newkey rsa:2048 -keyout "$INFERENCE_KEY" -out "$INFERENCE_CERT" -days 365 -nodes -subj '/CN=inference.geist.im' 2>/dev/null
        chmod 644 "$INFERENCE_CERT"
        chmod 600 "$INFERENCE_KEY"
        echo "✅ Self-signed certificates created"
    else
        echo "✅ SSL certificates found. HTTPS server block enabled."
    fi
fi

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration is invalid"
    exit 1
fi

echo ""
echo "🚀 Starting nginx..."
echo "   - HTTP: port 80"
echo "   - HTTPS: port 443 (SSL certificates required)"
echo ""
echo "📍 Routing:"
echo "   inference.geist.im → $INFERENCE_HOST:8080"

# Start nginx in foreground
exec nginx -g "daemon off;"
