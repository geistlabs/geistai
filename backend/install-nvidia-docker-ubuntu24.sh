#!/bin/bash

# NVIDIA Container Toolkit Installation Script for Ubuntu 24.04
# This script installs the NVIDIA Container Toolkit to enable Docker GPU support

echo "🚀 Installing NVIDIA Container Toolkit for Ubuntu 24.04"
echo "======================================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script needs to be run with sudo privileges"
    echo "Please run: sudo bash install-nvidia-docker-ubuntu24.sh"
    exit 1
fi

echo "📋 Installing for Ubuntu 24.04 (Noble)"

# Update package list
echo "🔄 Updating package list..."
apt-get update

# Install prerequisites
echo "📦 Installing prerequisites..."
apt-get install -y curl gnupg2 software-properties-common

# Add NVIDIA package repositories
echo "📦 Adding NVIDIA package repositories..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Update package list again
echo "🔄 Updating package list with NVIDIA repositories..."
apt-get update

# Install NVIDIA Container Toolkit
echo "📥 Installing NVIDIA Container Toolkit..."
apt-get install -y nvidia-container-toolkit

# Configure Docker to use NVIDIA runtime
echo "⚙️  Configuring Docker for NVIDIA support..."
nvidia-ctk runtime configure --runtime=docker

# Restart Docker service
echo "🔄 Restarting Docker service..."
systemctl restart docker

echo ""
echo "✅ NVIDIA Container Toolkit installation complete!"
echo ""
echo "🧪 Testing GPU access..."
if docker run --rm --gpus all nvidia/cuda:11.8-base nvidia-smi &> /dev/null; then
    echo "✅ Docker GPU access working!"
    echo ""
    echo "🚀 Your RTX 5070 is now ready for Docker GPU acceleration!"
    echo "   You can now enable GPU support in your GeistAI services."
else
    echo "❌ Docker GPU access test failed"
    echo "   Please check the installation and try again"
fi

echo ""
echo "📋 Next steps:"
echo "   1. Test GPU access: docker run --rm --gpus all nvidia/cuda:11.8-base nvidia-smi"
echo "   2. Enable GPU in GeistAI: Update docker-compose.yml to uncomment GPU settings"
echo "   3. Restart services: docker compose up inference -d"
