#!/bin/bash

# GeistAI Release Automation Script
# Usage: ./scripts/release.sh [version] [build-type]
# Example: ./scripts/release.sh 1.0.5 production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION=${1:-"1.0.5"}
BUILD_TYPE=${2:-"production"}
PROJECT_DIR="/Users/alexmartinez/openq-ws/geistai/frontend"

echo -e "${BLUE}🚀 GeistAI Release Automation${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Build Type: ${BUILD_TYPE}${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Pre-flight checks
echo -e "${BLUE}🔍 Pre-flight Checks${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in the frontend directory. Please run from /Users/alexmartinez/openq-ws/geistai/frontend"
    exit 1
fi

# Check if EAS CLI is installed
if ! command_exists eas; then
    print_error "EAS CLI not found. Please install with: npm install -g @expo/eas-cli"
    exit 1
fi

# Check if logged into EAS
if ! eas whoami >/dev/null 2>&1; then
    print_error "Not logged into EAS. Please run: eas login"
    exit 1
fi

print_status "All pre-flight checks passed"

# Update version in app.json
echo -e "${BLUE}📝 Updating Version${NC}"
if [ -f "app.json" ]; then
    # Update version in app.json
    if command_exists jq; then
        jq ".expo.version = \"${VERSION}\"" app.json > app.json.tmp && mv app.json.tmp app.json
        print_status "Updated app.json version to ${VERSION}"
    else
        print_warning "jq not found, please manually update version in app.json"
    fi
else
    print_error "app.json not found"
    exit 1
fi

# Update iOS Info.plist version
echo -e "${BLUE}📱 Updating iOS Version${NC}"
if [ -f "ios/GeistAI/Info.plist" ]; then
    # Update CFBundleShortVersionString
    sed -i '' "s/<string>.*<\/string>/<string>${VERSION}<\/string>/" ios/GeistAI/Info.plist
    print_status "Updated iOS Info.plist version to ${VERSION}"
else
    print_warning "iOS Info.plist not found"
fi

# Clean build artifacts
echo -e "${BLUE}🧹 Cleaning Build Artifacts${NC}"
rm -rf ios/build ios/Pods
print_status "Cleaned iOS build artifacts"

# Install pods
echo -e "${BLUE}📦 Installing CocoaPods${NC}"
cd ios
pod install
cd ..
print_status "CocoaPods installed successfully"

# Git operations
echo -e "${BLUE}📚 Git Operations${NC}"

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Uncommitted changes detected"
    echo "Do you want to commit these changes? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Release v${VERSION}: ${BUILD_TYPE} build"
        print_status "Changes committed"
    else
        print_warning "Proceeding with uncommitted changes"
    fi
fi

# Create release tag
echo -e "${BLUE}🏷️  Creating Release Tag${NC}"
TAG_NAME="ios-geistai-${VERSION}"
git tag -a "${TAG_NAME}" -m "iOS GeistAI Release v${VERSION}"
print_status "Created tag ${TAG_NAME}"

# Push to remote
echo -e "${BLUE}📤 Pushing to Remote${NC}"
# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch: ${CURRENT_BRANCH}${NC}"
git push origin "${CURRENT_BRANCH}"
git push origin "${TAG_NAME}"
print_status "Pushed to remote repository"

# Build with EAS
echo -e "${BLUE}🔨 Building with EAS${NC}"
print_info "Starting EAS build for ${BUILD_TYPE}..."

if [ "$BUILD_TYPE" = "production" ]; then
    eas build --platform ios --profile production --non-interactive
elif [ "$BUILD_TYPE" = "preview" ]; then
    eas build --platform ios --profile preview --non-interactive
else
    print_error "Invalid build type. Use 'production' or 'preview'"
    exit 1
fi

print_status "EAS build completed successfully"

# Submit to App Store (optional)
echo -e "${BLUE}📱 App Store Submission${NC}"
echo "Do you want to submit to App Store Connect? (y/n)"
read -r submit_response
if [[ "$submit_response" =~ ^[Yy]$ ]]; then
    print_info "Submitting to App Store Connect..."
    eas submit --platform ios --profile production --non-interactive
    print_status "Submitted to App Store Connect"
else
    print_info "Skipping App Store submission"
fi

# Summary
echo ""
echo -e "${GREEN}🎉 Release v${VERSION} completed successfully!${NC}"
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "  • Version: ${VERSION}"
echo -e "  • Build Type: ${BUILD_TYPE}"
echo -e "  • Git Tag: v${VERSION}"
echo -e "  • EAS Build: Completed"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "  1. Check EAS build status: eas build:list"
echo -e "  2. Download build from: https://expo.dev/accounts/rickkdev/projects/geist-v2/builds"
echo -e "  3. Test the build on TestFlight"
echo -e "  4. Monitor for any issues"
echo ""
echo -e "${GREEN}Happy releasing! 🚀${NC}"
