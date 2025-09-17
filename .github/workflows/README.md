# Backend Services Release Workflows

This directory contains GitHub Actions workflows for building and releasing the four backend services: embedder, inference, nginx, and router.

## How to Use

### Tag Format
Tags should follow this format: `{service}-{environment}-{version}`

Where:
- `service`: One of `embedder`, `inference`, `nginx`, or `router`
- `environment`: `development`, `staging`, or `production`
- `version`: Semantic version (e.g., `1.0.0`, `2.1.3`)

### Examples

#### Release embedder service v1.0.55 to development:
```bash
git add . && git commit -m "embedder updates" && git tag -f embedder-development-1.0.55 && git push -f origin embedder-development-1.0.55
```

#### Release router service v2.1.0 to production:
```bash
git add . && git commit -m "router production release" && git tag -f router-production-2.1.0 && git push -f origin router-production-2.1.0
```

#### Release nginx service v1.2.3 to staging:
```bash
git add . && git commit -m "nginx staging updates" && git tag -f nginx-staging-1.2.3 && git push -f origin nginx-staging-1.2.3
```

#### Release inference service v3.0.0 to development:
```bash
git add . && git commit -m "inference development build" && git tag -f inference-development-3.0.0 && git push -f origin inference-development-3.0.0
```

## Docker Images

Each service will be pushed to Docker Hub with the following tags:
- `{username}/{service}:{version}` (e.g., `alo42/embedder:1.0.55`)
- `{username}/{service}:{environment}-{version}` (e.g., `alo42/embedder:development-1.0.55`)
- `{username}/{service}:{environment}-latest` (e.g., `alo42/embedder:development-latest`)

## Required Secrets

Make sure the following secrets are configured in your GitHub repository:
- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password or access token

## Workflow Files

- `release-services.yml`: Main workflow that parses tags and triggers appropriate service builds
- `build-embedder.yml`: Builds and pushes the embedder service Docker image
- `build-inference.yml`: Builds and pushes the inference service Docker image  
- `build-nginx.yml`: Builds and pushes the nginx service Docker image
- `build-router.yml`: Builds and pushes the router service Docker image

## Multi-platform Support

All Docker images are built for both `linux/amd64` and `linux/arm64` platforms to support various deployment environments.
