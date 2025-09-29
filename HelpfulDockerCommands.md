# Helpful Docker Commands

Sometimes Docker just gets... stuck.

Rather than investigate the exact reason, it's often more expedient to simply unplug it all and plug it back in.

## GeistAI Startup (GPU Auto-Detection)

The `start.sh` script automatically detects GPU availability and starts the appropriate services:

```bash
# Auto-detect and start
./start.sh

# Force GPU mode
./start.sh --gpu

# Force CPU mode  
./start.sh --cpu

# Run detached with auto-detection
./start.sh -d

# Force CPU mode with rebuild
./start.sh --cpu --build
```

## Manual Docker Compose Commands

If you prefer manual control:

```bash
# CPU-only mode (no GPU)
docker compose --profile cpu up

# GPU mode (requires NVIDIA Docker)
docker compose --profile gpu up

# Check GPU availability
docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi
```

## Stop and Remove All Containers

```bash
docker stop $(docker ps -aq) && docker rm $(docker ps -aq)
```

## Docker System Prune

```bash
docker system prune -f --volumes
```

## Remove All Volumes

```bash
docker volume rm $(docker volume ls -q)
```

## Remove All Images

```bash
docker rmi -f $(docker images -a -q)
```

## Kill Process on a Port

```bash
lsof -ti tcp:<PORT> | xargs kill
```

## Remove All

```bash
docker stop $(docker ps -aq) && docker rm $(docker ps -aq) && docker system prune -f --volumes && docker volume rm $(docker volume ls -q)
```
