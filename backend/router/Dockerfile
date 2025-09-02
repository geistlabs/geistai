 # Start with Python 3.11 as our base
 FROM python:3.11-slim

 # Install system dependencies 
 RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

 # Set working directory
 WORKDIR /app

 # Copy project files
 COPY pyproject.toml .
 COPY main.py .

# Install dependencies 
RUN pip install fastapi uvicorn httpx

# Create non-root user
RUN useradd -m -u 1000 router && chown -R router:router /app
USER router

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]