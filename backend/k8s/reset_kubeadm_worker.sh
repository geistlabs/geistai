#!/bin/bash

# Function to print messages in color
print_in_color() {
  local color_code="$1"
  local message="$2"
  echo -e "\033[${color_code}m${message}\033[0m"
}

print_in_color "33" "Resetting kubeadm worker..."

kubeadm reset -f

print_in_color "31" "Removing CNI network configurations..."
rm -rf /etc/cni/net.d

print_in_color "31" "Removing Kubernetes configurations..."
rm -rf /etc/kubernetes

print_in_color "31" "Removing etcd data..."
rm -rf /var/lib/etcd

print_in_color "31" "Removing kubelet data..."
rm -rf /var/lib/kubelet

print_in_color "31" "Removing CNI data..."
rm -rf /var/lib/cni

print_in_color "32" "Kubeadm worker reset complete."