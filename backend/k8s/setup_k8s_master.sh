#!/bin/bash

# Function to print messages in color
print_in_color() {
  local color_code="$1"
  local message="$2"
  echo -e "\033[${color_code}m${message}\033[0m"
}

print_in_color "32" "Setting up k8s master..."

print_in_color "34" "Updating apt..."

sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl

sudo curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg

sudo echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list

print_in_color "34" "Installing Kubernetes components..."

sudo apt-get update
sudo apt-get install -y kubeadm kubectl kubelet