"""Configuration settings for the router service."""

import os

# Harmony configuration
HARMONY_ENABLED = os.getenv("HARMONY_ENABLED", "true").lower() == "true"
HARMONY_REASONING_EFFORT = os.getenv("HARMONY_REASONING_EFFORT", "low")  # "low", "medium", "high"

# Inference service settings
INFERENCE_URL = os.getenv("INFERENCE_URL", "http://localhost:8080")
INFERENCE_TIMEOUT = int(os.getenv("INFERENCE_TIMEOUT", "60"))

# API settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))