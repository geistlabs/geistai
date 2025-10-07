import os

# API Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8001"))

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Model Configuration
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "all-MiniLM-L6-v2")
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/opt/venv/models")
SENTENCE_TRANSFORMERS_HOME = os.getenv("SENTENCE_TRANSFORMERS_HOME", "/opt/venv/models")

# Performance Configuration
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "32"))
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "8192"))
