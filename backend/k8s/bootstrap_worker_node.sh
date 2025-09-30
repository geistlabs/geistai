#!/usr/bin/env bash
# Bootstrap a fresh Kubernetes worker node on Ubuntu (containerd + kubeadm)
# Usage:
#   sudo bash bootstrap_worker_node.sh <JOIN_COMMAND>
# Example:
#   sudo bash bootstrap_worker_node.sh "kubeadm join 192.168.1.100:6443 --token abc123.xyz789 --discovery-token-ca-cert-hash sha256:abcd1234..."
# Optional env overrides:
#   DISABLE_FIREWALL=true K8S_VERSION=1.33.0-1.1

set -euo pipefail

### --- Config (override via env) ---
K8S_PKG_SUFFIX="${K8S_VERSION:-}"                     # e.g. "1.33.0-1.1" or empty for latest from repo
DISABLE_FIREWALL="${DISABLE_FIREWALL:-true}"

### --- Safety checks ---
if [[ $EUID -ne 0 ]]; then
  echo "[FATAL] Run as root (sudo)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[FATAL] This script targets Ubuntu/Debian with apt." >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  echo "[FATAL] Please provide the kubeadm join command as an argument." >&2
  echo "Usage: sudo bash $0 \"kubeadm join <control-plane-ip>:6443 --token <token> --discovery-token-ca-cert-hash <hash>\"" >&2
  exit 1
fi

JOIN_COMMAND="$*"
echo "[INFO] Join command: ${JOIN_COMMAND}"

### --- Disable swap (required) ---
echo "[STEP] Disabling swap..."
swapoff -a || true
# Comment out any swap lines in fstab
sed -ri 's@^([^#].*\s+swap\s+.*)$@# \1@' /etc/fstab || true

### --- Optional: open the host firewall completely ---
if [[ "${DISABLE_FIREWALL}" == "true" ]]; then
  echo "[STEP] Disabling UFW and flushing nftables/iptables..."
  if command -v ufw >/dev/null 2>&1; then
    ufw disable || true
    systemctl stop ufw 2>/dev/null || true
    systemctl disable ufw 2>/dev/null || true
  fi
  # Keep SSH open before flush (best-effort)
  iptables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
  ip6tables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true

  # nftables
  if command -v nft >/dev/null 2>&1; then
    nft list ruleset >/dev/null 2>&1 && nft flush ruleset || true
  fi
  # iptables v4
  iptables -F || true; iptables -X || true
  iptables -t nat -F || true; iptables -t nat -X || true
  iptables -t mangle -F || true; iptables -t mangle -X || true
  iptables -P INPUT ACCEPT || true
  iptables -P FORWARD ACCEPT || true
  iptables -P OUTPUT ACCEPT || true
  # iptables v6
  ip6tables -F || true; ip6tables -X || true
  ip6tables -t nat -F 2>/dev/null || true; ip6tables -t nat -X 2>/dev/null || true
  ip6tables -t mangle -F || true; ip6tables -t mangle -X || true
  ip6tables -P INPUT ACCEPT || true
  ip6tables -P FORWARD ACCEPT || true
  ip6tables -P OUTPUT ACCEPT || true
fi

### --- Kernel modules & sysctls ---
echo "[STEP] Ensuring kernel modules and sysctls..."
modprobe overlay || true
modprobe br_netfilter || true
cat >/etc/sysctl.d/99-kubernetes-cri.conf <<'EOF'
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF
sysctl --system >/dev/null

### --- Container runtime: containerd ---
echo "[STEP] Installing/configuring containerd..."
apt-get update -y
if ! dpkg -s containerd >/dev/null 2>&1; then
  apt-get install -y containerd
fi
mkdir -p /etc/containerd
if [[ ! -f /etc/containerd/config.toml ]]; then
  containerd config default >/etc/containerd/config.toml
fi
# Ensure SystemdCgroup = true
sed -i 's/^\(\s*SystemdCgroup\s*=\s*\)false/\1true/' /etc/containerd/config.toml

# Optional: set sandbox image explicitly (helps on some airgapped/slow pulls)
if ! grep -q 'sandbox_image' /etc/containerd/config.toml; then
  sed -i 's#\[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options\]#\[plugins."io.containerd.grpc.v1.cri".containerd\]\nsandbox_image = "registry.k8s.io/pause:3.9"\n\n[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]#' /etc/containerd/config.toml
fi

systemctl daemon-reload
systemctl enable --now containerd

# crictl -> containerd socket
cat >/etc/crictl.yaml <<'EOF'
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
debug: false
EOF

### --- Kubernetes packages (kubelet/kubeadm/kubectl) ---
echo "[STEP] Installing Kubernetes components..."
# Ensure the Kubernetes apt repo exists (handles fresh hosts)
if [[ ! -f /etc/apt/keyrings/kubernetes-apt-keyring.gpg ]]; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.33/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
  chmod 0644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg
  cat >/etc/apt/sources.list.d/kubernetes.list <<'EOF'
deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.33/deb/ /
EOF
fi
apt-get update -y

# If K8S_PKG_SUFFIX is set, pin to that version; else install latest from repo
if [[ -n "${K8S_PKG_SUFFIX}" ]]; then
  apt-get install -y kubelet="${K8S_PKG_SUFFIX}" kubeadm="${K8S_PKG_SUFFIX}" kubectl="${K8S_PKG_SUFFIX}"
else
  apt-get install -y kubelet kubeadm kubectl
fi
apt-mark hold kubelet kubeadm kubectl

systemctl enable kubelet  # kubeadm will hand it configs; it's okay if it's not running yet

### --- Join the cluster ---
echo "[STEP] Joining the Kubernetes cluster..."
# Add the CRI socket to the join command if not already present
if [[ "${JOIN_COMMAND}" != *"--cri-socket"* ]]; then
  JOIN_COMMAND="${JOIN_COMMAND} --cri-socket unix:///run/containerd/containerd.sock"
fi

# Execute the join command
eval "${JOIN_COMMAND}"

### --- Wait for node to become Ready ---
echo "[STEP] Waiting for worker node to become Ready..."
for i in {1..60}; do
  NODE_STATUS=$(kubectl --kubeconfig=/etc/kubernetes/kubelet.conf get nodes "$(hostname)" --no-headers 2>/dev/null | awk '{print $2}' || echo "NotFound")
  if [[ "${NODE_STATUS}" == "Ready" ]]; then
    echo "[INFO] Node is Ready!"
    break
  fi
  echo "  Node status: ${NODE_STATUS}, waiting..."
  sleep 5
done

# Show final status
echo "[STEP] Final node status:"
kubectl --kubeconfig=/etc/kubernetes/kubelet.conf get nodes "$(hostname)" -o wide 2>/dev/null || echo "[WARN] Could not retrieve node status"

echo
echo "================== SUCCESS =================="
echo "Worker node has joined the cluster successfully."
echo "Node name: $(hostname)"
echo "============================================="
