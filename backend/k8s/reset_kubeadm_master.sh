#!/bin/bash

echo "Resetting kubeadm master..."

kubeadm reset -f

rm -rf /etc/cni/net.d
rm -rf /etc/kubernetes
rm -rf /var/lib/etcd
rm -rf /var/lib/kubelet
rm -rf /var/lib/cni
rm -rf /var/lib/kubelet