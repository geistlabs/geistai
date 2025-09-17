#!/bin/bash

# Check which input devices are associated with the HS6209
for event in /dev/input/event*; do
    device_name=$(cat /sys/class/input/$(basename $event)/device/name 2>/dev/null)
    if [[ "$device_name" == *"HS6209"* ]]; then
        echo "Found HS6209 device: $event ($device_name)"
    fi
done