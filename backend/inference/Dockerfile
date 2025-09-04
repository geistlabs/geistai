FROM ghcr.io/ggml-org/llama.cpp:server

# Create models directory for volume mount
USER root
RUN mkdir -p /models && chown 1000:1000 /models

# Switch back to non-root user
USER 1000

EXPOSE 8080

# Just provide the arguments (ENTRYPOINT already has /app/llama-server)
CMD ["--model", "/models/gpt-oss-20b-Q4_K_S.gguf", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--ctx-size", "4096", \
     "--threads", "4", \
     "--batch-size", "512", \
     "--ubatch-size", "512", \
     "--parallel", "1", \
     "--cont-batching", \
     "--mlock"]

		#  docker run -d \
		#  --name inference-server \
		#  -p 8080:8080 \
		#  -v /root/models:/models:ro \
		#  alo42/inference:latest