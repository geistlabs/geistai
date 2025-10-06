#!/bin/bash

# Quick Release Script for GeistAI
# Usage: ./scripts/quick-release.sh [version]
# Example: ./scripts/quick-release.sh 1.0.5

set -e

VERSION=${1:-"1.0.5"}
PROJECT_DIR="/Users/alexmartinez/openq-ws/geistai/frontend"

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
cd ios && pod install && cd ..

# Git operations
echo "📚 Git operations..."
git add .
git commit -m "Release v${VERSION}"
git tag "v${VERSION}"
git push origin main
git push origin "v${VERSION}"

# EAS build
echo "🔨 Building with EAS..."
eas build --platform ios --profile production --non-interactive

echo "✅ Quick release v${VERSION} completed!"
echo "📱 Check build status: eas build:list"
