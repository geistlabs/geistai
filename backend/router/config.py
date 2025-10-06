"""Configuration settings for the router service."""

import os
import ssl
from pathlib import Path

# Harmony configuration
HARMONY_ENABLED = os.getenv("HARMONY_ENABLED", "true").lower() == "true"
HARMONY_REASONING_EFFORT = os.getenv(
    "HARMONY_REASONING_EFFORT", "low"
)  # "low", "medium", "high"

# External service settings
INFERENCE_URL = os.getenv("INFERENCE_URL", "https://inference.geist.im")
INFERENCE_TIMEOUT = int(os.getenv("INFERENCE_TIMEOUT", "60"))


# Embeddings service settings
EMBEDDINGS_URL = os.getenv("EMBEDDINGS_URL", "http://embeddings:8001")
EMBEDDINGS_TIMEOUT = int(os.getenv("EMBEDDINGS_TIMEOUT", "60"))

# Embeddings API URL configuration - this is the base route for all embeddings calls
# Should be set to VITE_API_URL/embeddings (e.g., http://localhost:8000/embeddings)
EMBEDDINGS_API_URL = os.getenv("EMBEDDINGS_API_URL", "http://localhost:8000/embeddings")

# API settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Token settings
MAX_TOKENS = 1500

# SSL settings
SSL_ENABLED = os.getenv("SSL_ENABLED", "false").lower() == "true"
SSL_CERT_PATH = os.getenv("SSL_CERT_PATH", "/app/certificates/cert.pem")
SSL_KEY_PATH = os.getenv("SSL_KEY_PATH", "/app/certificates/key.pem")


def validate_ssl_config():
    """Validate SSL configuration and certificate files."""
    if not SSL_ENABLED:
        return True, "SSL disabled"

    cert_path = Path(SSL_CERT_PATH)
    key_path = Path(SSL_KEY_PATH)

    # Check if certificate file exists
    if not cert_path.exists():
        return False, f"SSL certificate file not found: {SSL_CERT_PATH}"

    # Check if private key file exists
    if not key_path.exists():
        return False, f"SSL private key file not found: {SSL_KEY_PATH}"

    # Skip permission checks - allow insecure permissions
    # if (
    #     key_path.stat().st_mode & 0o077
    # ):  # Check if key file has world/group read permissions
    #     return False, f"SSL private key file has insecure permissions: {SSL_KEY_PATH}"

    try:
        # Try to load the certificate and key
        with open(cert_path, "rb") as f:
            cert_data = f.read()

        with open(key_path, "rb") as f:
            key_data = f.read()

        # Basic validation - check if files contain PEM data
        if b"-----BEGIN CERTIFICATE-----" not in cert_data:
            return False, f"Invalid certificate format in {SSL_CERT_PATH}"

        if b"-----BEGIN" not in key_data or b"PRIVATE KEY" not in key_data:
            return False, f"Invalid private key format in {SSL_KEY_PATH}"

        return True, "SSL configuration valid"

    except Exception as e:
        return False, f"Error validating SSL files: {str(e)}"


def get_ssl_context():
    """Create SSL context for the server."""
    if not SSL_ENABLED:
        return None

    try:
        context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        context.load_cert_chain(SSL_CERT_PATH, SSL_KEY_PATH)
        return context
    except Exception as e:
        raise RuntimeError(f"Failed to create SSL context: {str(e)}")
