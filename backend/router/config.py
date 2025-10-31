"""Configuration settings for the router service."""

import os
from pathlib import Path

"""Configuration settings for the router service."""

import os
from pathlib import Path

# Load .env file from parent directory when running locally
try:
    from dotenv import load_dotenv
    # Get the directory where this config.py file is located
    current_dir = Path(__file__).parent
    # Go up one directory to find the .env file
    parent_dir = current_dir.parent
    env_file = parent_dir / ".env"
    
    if env_file.exists():
        load_dotenv(env_file)
        print(f"Loaded environment variables from: {env_file}")
    else:
        print(f"No .env file found at: {env_file}")
except ImportError:
    print("python-dotenv not installed, skipping .env file loading")

# Gpt configuration




# Gpt configuration
REASONING_EFFORT = os.getenv("REASONING_EFFORT", "low")  # "low", "medium", "high"

# Orchestrator configuration
# Note: Always using nested orchestrator (can handle single-layer or multi-layer scenarios)

# External service settings
INFERENCE_URL = os.getenv("INFERENCE_URL", "http://localhost:8080")

INFERENCE_TIMEOUT = int(os.getenv("INFERENCE_TIMEOUT", "300"))
REMOTE_INFERENCE_URL=os.getenv("REMOTE_INFERENCE_URL", "https://api.studio.nebius.com")
REMOTE_INFERENCE_KEY=os.getenv("REMOTE_INFERENCE_KEY", "")
REMOTE_INFERENCE_MODEL=os.getenv("REMOTE_INFERENCE_MODEL", "openai/gpt-oss-20b")
USE_REMOTE_INFERENCE = os.getenv("USE_REMOTE_INFERENCE", "false").lower() == "true"

# Gemini API configuration for reasonableness service (always enabled with grounding)
RATING_INFERENCE_URL = os.getenv("RATING_INFERENCE_URL", "https://aiplatform.googleapis.com/v1/publishers/google")
RATING_INFERENCE_KEY = os.getenv("RATING_INFERENCE_KEY", "")
RATING_INFERENCE_MODEL = os.getenv("RATING_INFERENCE_MODEL", "gemini-2.0-flash-exp")

if USE_REMOTE_INFERENCE:
    print("Using remote inference")
else:
    print("Using local inference")

# Main inference model configuration
INFERENCE_URL = "https://inference.geist.im"

# MCP service configuration
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
MCP_BRAVE_URL = os.getenv("MCP_BRAVE_URL", "http://mcp-brave:3000") + "/mcp/"
MCP_FETCH_URL = os.getenv("MCP_FETCH_URL", "http://mcp-fetch:8000") + "/mcp/"
MCP_URLS = [MCP_BRAVE_URL, MCP_FETCH_URL]
# ... rest of your existing config
# Embeddings service settings
EMBEDDINGS_URL = os.getenv("EMBEDDINGS_URL", "http://embeddings:8001")
EMBEDDINGS_TIMEOUT = int(os.getenv("EMBEDDINGS_TIMEOUT", "60"))

# Memory extraction service settings
MEMORY_EXTRACTION_URL = os.getenv("MEMORY_EXTRACTION_URL", "https://memory.geist.im")
MEMORY_EXTRACTION_TIMEOUT = int(os.getenv("MEMORY_EXTRACTION_TIMEOUT", "60"))

# Embeddings API URL configuration - this is the base route for all embeddings calls
# Should be set to VITE_API_URL/embeddings (e.g., http://localhost:8000/embeddings)
EMBEDDINGS_API_URL = os.getenv("EMBEDDINGS_API_URL", "http://localhost:8000/embeddings")

# API settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Token settings
MAX_TOKENS = 16384

# Tool calling settings
ENABLE_TOOL_CALLS = os.getenv("ENABLE_TOOL_CALLS", "true").lower() == "true"
