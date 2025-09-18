FROM ghcr.io/ggml-org/llama.cpp:server-cuda

# Create models directory for volume mount
USER root
RUN mkdir -p /models && chown 1000:1000 /models

# Switch back to non-root user
USER 1000

EXPOSE 8080

# Just provide the arguments (ENTRYPOINT already has /app/llama-server)
# Optimized for NVIDIA RTX 5070 (8GB VRAM)
CMD ["--model", "/models/gpt-oss-20b-Q4_K_S.gguf", \
		"--host", "0.0.0.0", \
		"--port", "8080", \
		"--ctx-size", "4096", \
		"--threads", "8", \
		"--batch-size", "1024", \
		"--ubatch-size", "1024", \
		"--parallel", "1", \
		"--cont-batching", \
		"--mlock", \
		"--n-gpu-layers", "-1", \
		"--gpu-split", "auto"]

# Example usage:
# docker run -d \
#   --name inference-server \
#   --gpus all \
#   -p 8080:8080 \
#   -v /root/models:/models:ro \
#   alo42/inference:latest


# In order to use the GPU, we need to install the nvidia-container-toolkit on the host machine.

		# Add the package repositories
# distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
# curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
# curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# # Install and restart Docker
# sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
# sudo systemctl restart docker

# You can test Docker GPU access with this
# docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi