#!/usr/bin/env bash
# Bootstrap a fresh Kubernetes control plane on Ubuntu (containerd + kubeadm + Calico)
# Usage:
#   sudo bash bootstrap_control_plane.sh
# Optional env overrides:
#   POD_CIDR=192.168.0.0/16 CP_IP=1.2.3.4 DISABLE_FIREWALL=true K8S_VERSION=1.33.0-1.1

set -euo pipefail

### --- Config (override via env) ---
POD_CIDR="${POD_CIDR:-192.168.0.0/16}"                # Calico default pool
K8S_PKG_SUFFIX="${K8S_VERSION:-}"                     # e.g. "1.30.4-1.1" or empty for latest from repo
DISABLE_FIREWALL="${DISABLE_FIREWALL:-true}"

# Auto-detect advertise address if not provided
if [[ -z "${CP_IP:-}" ]]; then
  # Pick the source IP for the default route
  CP_IP="$(ip -4 route get 1.1.1.1 | awk '/src/ {for(i=1;i<=NF;i++){if($i=="src"){print $(i+1); exit}}}')"
fi

echo "[INFO] Using advertise IP: ${CP_IP}"
echo "[INFO] Using Pod CIDR:     ${POD_CIDR}"

### --- Safety checks ---
if [[ $EUID -ne 0 ]]; then
  echo "[FATAL] Run as root (sudo)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[FATAL] This script targets Ubuntu/Debian with apt." >&2
  exit 1
fi

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

### --- kubeadm init ---
echo "[STEP] Initializing control plane with kubeadm..."
# If a previous failed init left files, clean them (but we assume you just ran reset)
rm -rf /etc/kubernetes/pki/etcd/member 2>/dev/null || true

kubeadm init \
  --pod-network-cidr="${POD_CIDR}" \
  --apiserver-advertise-address="${CP_IP}"

### --- kubectl config for root and the invoking user ---
echo "[STEP] Setting up kubeconfig..."
mkdir -p /root/.kube
cp -i /etc/kubernetes/admin.conf /root/.kube/config
chown root:root /root/.kube/config

if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  USER_HOME="$(getent passwd "${SUDO_USER}" | cut -d: -f6)"
  mkdir -p "${USER_HOME}/.kube"
  cp -i /etc/kubernetes/admin.conf "${USER_HOME}/.kube/config"
  chown "$(id -u "${SUDO_USER}")":"$(id -g "${SUDO_USER}")" "${USER_HOME}/.kube/config"
fi

### --- CNI: Calico ---
echo "[STEP] Installing Calico CNI..."
# Apply the official Calico manifest (using original CNI version for compatibility)
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

### --- Remove control plane taints for pod scheduling ---
echo "[STEP] Removing control plane taints to allow pod scheduling..."
NODE_NAME=$(kubectl get nodes --no-headers -o custom-columns=NAME:.metadata.name | head -1)
kubectl taint nodes "${NODE_NAME}" node-role.kubernetes.io/control-plane- 2>/dev/null || true
kubectl taint nodes "${NODE_NAME}" node-role.kubernetes.io/master- 2>/dev/null || true

### --- Wait for Calico to be ready ---
echo "[STEP] Waiting for Calico CNI to be ready..."
echo "  Waiting for calico-node pods..."
kubectl wait --for=condition=Ready pod -l k8s-app=calico-node -n kube-system --timeout=300s || true

echo "  Waiting for calico-kube-controllers..."
kubectl wait --for=condition=Ready pod -l k8s-app=calico-kube-controllers -n kube-system --timeout=300s || true

### --- Wait for node to become Ready ---
echo "[STEP] Waiting for control-plane node to become Ready..."
for i in {1..60}; do
  NOTREADY=$(kubectl get nodes --no-headers 2>/dev/null | awk '$2!="Ready"{print}')
  if [[ -z "${NOTREADY}" ]]; then
    break
  fi
  sleep 5
done
kubectl get nodes -o wide || true
kubectl get pods -n kube-system -o wide || true

### --- Output join command ---
echo "[STEP] Generating worker join command..."
JOIN_CMD="$(kubeadm token create --print-join-command)"
echo "${JOIN_CMD} --cri-socket unix:///run/containerd/containerd.sock" | tee /root/worker_join.sh
chmod +x /root/worker_join.sh
echo "[INFO] Saved worker join helper to /root/worker_join.sh"

echo
echo "================== SUCCESS =================="
echo "Control plane is initialized."
echo "Advertise IP: ${CP_IP}"
echo "Pod CIDR:     ${POD_CIDR}"
echo "Join workers with:"
echo "  $(cat /root/worker_join.sh)"
echo "============================================="