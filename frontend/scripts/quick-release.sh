#!/bin/bash

# Quick Release Script for GeistAI
# Usage: ./scripts/quick-release.sh [version]
# Example: ./scripts/quick-release.sh 1.0.5

set -e

PROJECT_DIR="/Users/alexmartinez/openq-ws/geistai/frontend"

# Auto-increment version if not provided
if [ -z "$1" ]; then
    echo "🔍 Auto-detecting next version..."

    # Get current version from app.json
    if command -v jq >/dev/null 2>&1; then
        CURRENT_VERSION=$(jq -r '.expo.version' app.json 2>/dev/null || echo "1.0.0")
    else
        CURRENT_VERSION=$(grep -o '"version": "[^"]*"' app.json | cut -d'"' -f4 || echo "1.0.0")
    fi

    echo "Current version: ${CURRENT_VERSION}"

    # Auto-increment patch version
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}

    NEW_PATCH=$((PATCH + 1))
    VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

    echo "✅ Auto-incremented to: ${VERSION}"
else
    VERSION=$1
fi

echo "🚀 Quick Release v${VERSION}"

# Update version
echo "📝 Updating version to ${VERSION}..."
if command -v jq >/dev/null 2>&1; then
    jq ".expo.version = \"${VERSION}\"" app.json > app.json.tmp && mv app.json.tmp app.json
    echo "✅ Updated app.json"
fi

# Clean and build
echo "🧹 Cleaning..."
rm -rf ios/build ios/Pods
npx expo prebuild --platform ios --clean

# Git operations
echo "📚 Git operations..."
git add .
git commit -m "Release v${VERSION}"
# Get current branch name for tagging
CURRENT_BRANCH=$(git branch --show-current)
TAG_NAME="ios-geistai-${VERSION}"
git tag "${TAG_NAME}"
echo "Current branch: ${CURRENT_BRANCH}"
echo "Tag name: ${TAG_NAME}"
git push origin "${CURRENT_BRANCH}"
git push origin "${TAG_NAME}"

# EAS build
echo "🔨 Building with EAS..."
eas build --platform ios --profile production --non-interactive

echo "✅ Quick release v${VERSION} completed!"
echo "📱 Check build status: eas build:list"
