#!/usr/bin/env bash
# kubeadm-nuke-control-plane-calico.sh
# Reset a kubeadm-initialized CONTROL-PLANE node for a clean re-init with Calico.
# Completely removes kubeadm/kubectl/kubelet packages.

set -euo pipefail

# -------- CONFIG --------
# Set to "true" if this node ran stacked etcd (kubeadm default)
NUKE_STACKED_ETCD="${NUKE_STACKED_ETCD:-true}"

# If you used a custom CRI socket, set it here (e.g., unix:///run/containerd/containerd.sock)
CRI_SOCKET="${CRI_SOCKET:-}"

# Calico commonly uses a 192.168.0.0/16 Pod CIDR by default.
# You'll pass this to kubeadm init later; included here just for echo in the footer.
CALICO_POD_CIDR="${CALICO_POD_CIDR:-192.168.0.0/16}"
# ------------------------

need_root() {
  if [[ $EUID -ne 0 ]]; then
    echo "Please run as root (sudo)." >&2
    exit 1
  fi
}

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

log()  { printf "\033[1;36m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }

need_root

log "Disabling swap (required for kubeadm)..."
swapoff -a || true
if [[ -w /etc/fstab ]]; then
  sed -r -i.bak '/\sswap\s/s/^/# /' /etc/fstab || true
fi

log "Stopping kubelet if running..."
systemctl stop kubelet 2>/dev/null || true

# Stop common CNI agents if present (Calico, etc.)
for svc in calico-node flanneld kube-router; do
  systemctl stop "$svc" 2>/dev/null || true
done

log "Running 'kubeadm reset -f'..."
if [[ -n "${CRI_SOCKET}" ]]; then
  kubeadm reset -f --cri-socket="${CRI_SOCKET}" || true
else
  kubeadm reset -f || true
fi

# CRI cleanup
if cmd_exists crictl; then
  log "Cleaning CRI pods/containers via crictl..."
  if [[ -z "${CRI_SOCKET}" ]]; then
    for sock in \
      "unix:///run/containerd/containerd.sock" \
      "unix:///var/run/containerd/containerd.sock" \
      "unix:///var/run/crio/crio.sock" \
      "unix:///var/run/dockershim.sock"; do
      if [[ -S ${sock#unix://} ]]; then
        export CONTAINER_RUNTIME_ENDPOINT="$sock"
        break
      fi
    done
  else
    export CONTAINER_RUNTIME_ENDPOINT="$CRI_SOCKET"
  fi
  crictl ps -aq | xargs -r crictl stop || true
  crictl ps -aq | xargs -r crictl rm || true
  # Optional: wipe images
  # crictl images -q | xargs -r crictl rmi || true
else
  warn "crictl not found; skipping CRI-level cleanup."
fi

log "Removing Kubernetes state directories..."
rm -rf \
  /etc/kubernetes \
  /var/lib/kubelet/* \
  /var/lib/cni \
  /etc/cni/net.d \
  /run/flannel \
  /var/run/flannel \
  /var/lib/calico

if [[ "${NUKE_STACKED_ETCD}" == "true" ]]; then
  if [[ -d /var/lib/etcd ]]; then
    log "Removing stacked etcd data at /var/lib/etcd ..."
    rm -rf /var/lib/etcd
  else
    warn "/var/lib/etcd not found; assuming external etcd or already cleaned."
  fi
else
  warn "NUKE_STACKED_ETCD=false; leaving /var/lib/etcd intact."
fi

log "Removing kubeconfig(s) for root and current user (if present)..."
rm -f /root/.kube/config 2>/dev/null || true
rm -rf /root/.kube 2>/dev/null || true
if [[ -n "${SUDO_USER-}" && "${SUDO_USER}" != "root" ]]; then
  USER_HOME=$(getent passwd "${SUDO_USER}" | cut -d: -f6)
  if [[ -n "$USER_HOME" && -d "$USER_HOME" ]]; then
    rm -f "$USER_HOME/.kube/config" 2>/dev/null || true
    rmdir "$USER_HOME/.kube" 2>/dev/null || true
  fi
fi

log "Deleting common CNI interfaces (ignore errors if not present)..."
# Calico interfaces commonly: cni0, kube-ipvs0, vxlan.calico, cali*, etc.
for link in cni0 kube-ipvs0 vxlan.calico kube-bridge docker0 flannel.1 flannel.4096 cali*; do
  ip link del "$link" 2>/dev/null || true
done

log "Flushing iptables/nftables rules created by Kubernetes/CNI..."
for table in filter nat mangle raw; do
  iptables -t "$table" -F 2>/dev/null || true
  iptables -t "$table" -X 2>/dev/null || true
  ip6tables -t "$table" -F 2>/dev/null || true
  ip6tables -t "$table" -X 2>/dev/null || true
done
if cmd_exists nft; then
  nft list tables 2>/dev/null | awk '/table (ip|ip6|inet) /{print $3,$2}' | while read -r family table; do
    case "$table" in
      kube*|cni*|calico*|flannel*) nft delete table "$family" "$table" 2>/dev/null || true ;;
    esac
  done
fi

log "Ensuring required kernel modules / sysctls (Calico + kubeadm)..."
modprobe br_netfilter 2>/dev/null || true
modprobe overlay 2>/dev/null || true
sysctl -w net.bridge.bridge-nf-call-iptables=1   >/dev/null 2>&1 || true
sysctl -w net.bridge.bridge-nf-call-ip6tables=1  >/dev/null 2>&1 || true
sysctl -w net.ipv4.ip_forward=1                  >/dev/null 2>&1 || true

log "Ensuring kubelet unit is sane (no global daemon-reload, no start)..."

# If kubelet was previously failed, clear that state (does not restart it)
systemctl reset-failed kubelet.service 2>/dev/null || true

# Make sure the kubelet unit file exists before enabling
if systemctl status kubelet.service >/dev/null 2>&1; then
  # Enable kubelet to start on boot, but do not start it now
  systemctl is-enabled kubelet >/dev/null 2>&1 || systemctl enable kubelet >/dev/null 2>&1 || true

  # In case unit symlinks changed and systemd wants a refresh for THIS unit only:
  # 'reenable' re-writes symlinks without a global daemon-reload.
  systemctl reenable kubelet >/dev/null 2>&1 || true
else
  warn "kubelet.service not found; skipping unit enable."
fi

log "Cleanup complete."
echo
echo "Next steps (Calico):"
echo "  1) Re-init control plane (example; set your advertise IP if needed):"
echo "       kubeadm init --pod-network-cidr=${CALICO_POD_CIDR} \\"
echo "         --apiserver-advertise-address=<CONTROL_PLANE_IP>"
echo
echo "  2) Configure kubectl for your user:"
echo "       mkdir -p \$HOME/.kube"
echo "       sudo cp -i /etc/kubernetes/admin.conf \$HOME/.kube/config"
echo "       sudo chown \$(id -u):\$(id -g) \$HOME/.kube/config"
echo
echo "  3) Install Calico:"
echo "       # Use the official Calico manifest URL for your version of Kubernetes"
echo "       kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml"
echo
echo "     Optional customizations BEFORE applying (advanced):"
echo "       # If you need a different PodCIDR, edit the IPPool in the manifest:"
echo "       #   spec:"
echo "       #     cidr: ${CALICO_POD_CIDR}"
echo "       # If you have multiple NICs, you can pin Calico's IP autodetection method."
echo "       # See the 'CALICO_IPV4POOL_CIDR' / 'IP_AUTODETECTION_METHOD' settings in the manifest."
echo
