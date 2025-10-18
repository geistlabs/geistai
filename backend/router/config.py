"""Configuration settings for the router service."""

import os
from pathlib import Path


# Load .env file from parent directory only for OpenAI key when running locally
def _load_openai_key_from_env():
    """Load OpenAI API key from .env file in parent directory if not already set."""
    if os.getenv("OPENAI_API_KEY"):
        return  # Already set, don't override

    try:
        from dotenv import load_dotenv

        # Get the directory where this config.py file is located
        current_dir = Path(__file__).parent
        # Go up one directory to find the .env file
        parent_dir = current_dir.parent
        env_file = parent_dir / ".env"

        if env_file.exists():
            load_dotenv(env_file)
            print(f"Loaded OpenAI key from: {env_file}")
    except ImportError:
        pass  # python-dotenv not installed, silently continue
    except Exception as e:
        print(f"Error loading .env file: {e}")


# Load OpenAI key from .env if needed
_load_openai_key_from_env()

# Gpt configuration
REASONING_EFFORT = os.getenv("REASONING_EFFORT", "low")  # "low", "medium", "high"

# Orchestrator configuration
# Note: Always using nested orchestrator (can handle single-layer or multi-layer scenarios)

# External service settings
INFERENCE_URL = os.getenv("INFERENCE_URL", "https://inference.geist.im")

INFERENCE_TIMEOUT = int(os.getenv("INFERENCE_TIMEOUT", "300"))
REMOTE_INFERENCE_URL = "https://api.openai.com"
USE_REMOTE_INFERENCE = os.getenv("USE_REMOTE_INFERENCE", "false").lower() == "true"
if USE_REMOTE_INFERENCE:
    {print("Using remote inference")}
else:
    {print("Using local inference")}
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

OPENAI_KEY = os.getenv("OPENAI_KEY", "")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
MCP_BRAVE_URL = os.getenv("MCP_BRAVE_URL", "http://mcp-brave:3000") + "/mcp/"
MCP_FETCH_URL = os.getenv("MCP_FETCH_URL", "http://mcp-fetch:8000") + "/mcp/"
MCP_URLS = [MCP_BRAVE_URL, MCP_FETCH_URL]
# ... rest of your existing config
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
MAX_TOKENS = 4096

# Tool calling settings
ENABLE_TOOL_CALLS = os.getenv("ENABLE_TOOL_CALLS", "true").lower() == "true"
