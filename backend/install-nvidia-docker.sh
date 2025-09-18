#!/bin/bash

# NVIDIA Container Toolkit Installation Script
# This script installs the NVIDIA Container Toolkit to enable Docker GPU support

echo "🚀 Installing NVIDIA Container Toolkit for Docker GPU Support"
echo "============================================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script needs to be run with sudo privileges"
    echo "Please run: sudo bash install-nvidia-docker.sh"
    exit 1
fi

# Detect distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID$VERSION_ID
else
    echo "❌ Cannot detect distribution"
    exit 1
fi

echo "📋 Detected distribution: $DISTRO"

# Add NVIDIA package repositories
echo "📦 Adding NVIDIA package repositories..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/$DISTRO/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Update package list
echo "🔄 Updating package list..."
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
echo "Run this command to test:"
echo "docker run --rm --gpus all nvidia/cuda:11.8-base nvidia-smi"
echo ""
echo "🚀 Your inference service will now use GPU acceleration!"
echo "Run: cd /home/alo/geistai/backend && docker compose up inference -d"
