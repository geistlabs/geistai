# 🚀 GeistAI Release Automation

This document describes the automated release process for GeistAI iOS app.

## 📋 Prerequisites

1. **EAS CLI installed**: `npm install -g @expo/eas-cli`
2. **Logged into EAS**: `eas login`
3. **jq installed** (optional, for version updates): `brew install jq`
4. **Git configured** with proper remote

## 🛠️ Available Scripts

### 🚀 Auto-Increment Features

Both release scripts now support automatic version incrementing:

#### **Auto-Increment Types:**

- **`patch`** (default): `1.0.5` → `1.0.6` (bug fixes)
- **`minor`**: `1.0.5` → `1.1.0` (new features)
- **`major`**: `1.0.5` → `2.0.0` (breaking changes)

#### **Usage Examples:**

```bash
# Auto-increment patch (most common)
./scripts/release.sh
./scripts/quick-release.sh

# Auto-increment specific type
./scripts/release.sh minor production
./scripts/release.sh major production

# Manual version (override auto-increment)
./scripts/release.sh 1.2.3 production
```

### 1. Full Release Script (`./scripts/release.sh`)

**Usage:**

```bash
./scripts/release.sh [version] [build-type]
```

**Examples:**

```bash
# Auto-increment patch version (default)
./scripts/release.sh

# Auto-increment specific type
./scripts/release.sh patch production
./scripts/release.sh minor production
./scripts/release.sh major production

# Manual version
./scripts/release.sh 1.0.5 production

# Preview release
./scripts/release.sh 1.0.5 preview
```

**What it does:**

- ✅ Pre-flight checks (EAS CLI, login status, directory)
- 📝 Updates version in `app.json` and `Info.plist`
- 🧹 Cleans build artifacts (`ios/build`, `ios/Pods`)
- 📦 Installs CocoaPods using `expo prebuild`
- 📚 Git operations (commit, tag, push)
- 🔨 EAS build
- 📱 Optional App Store submission

### 2. Quick Release Script (`./scripts/quick-release.sh`)

**Usage:**

```bash
./scripts/quick-release.sh [version]
```

**Examples:**

```bash
# Auto-increment patch version
./scripts/quick-release.sh

# Manual version
./scripts/quick-release.sh 1.0.5
```

**What it does:**

- 📝 Updates version
- 🧹 Cleans and installs pods using `expo prebuild`
- 📚 Git operations
- 🔨 EAS build

### 3. NPM Scripts

**Usage:**

```bash
# Full release
npm run release 1.0.5 production

# Quick release
npm run quick-release 1.0.5
```

## 📱 Release Process

### Step 1: Pre-Release Checklist

- [ ] **Code Review**: All changes reviewed and tested
- [ ] **Local Testing**: App works on physical device
- [ ] **Backend Deployed**: Latest backend changes deployed
- [ ] **Version Bump**: Decide on new version number
- [ ] **Changelog**: Document new features/fixes

### Step 2: Run Release Script

```bash
# For production release
./scripts/release.sh 1.0.5 production

# For preview/testing
./scripts/release.sh 1.0.5 preview
```

### Step 3: Monitor Build

```bash
# Check build status
eas build:list

# View build logs
eas build:view [build-id]
```

### Step 4: TestFlight Testing

1. **Download from EAS**: https://expo.dev/accounts/rickkdev/projects/geist-v2/builds
2. **Install on TestFlight**: Upload to App Store Connect
3. **Test on Device**: Verify recording and transcription work
4. **Monitor Logs**: Use Xcode console for debugging

### Step 5: Production Release

1. **App Store Connect**: Submit for review
2. **Monitor**: Check for crashes or issues
3. **Release Notes**: Update with new features

## 🔧 Manual Steps (if needed)

### Update Version Manually

```bash
# Update app.json
jq '.expo.version = "1.0.5"' app.json > app.json.tmp && mv app.json.tmp app.json

# Update iOS Info.plist
sed -i '' 's/<string>.*<\/string>/<string>1.0.5<\/string>/' ios/GeistAI/Info.plist
```

### Clean Build Artifacts

```bash
rm -rf ios/build ios/Pods
npx expo prebuild --platform ios --clean
```

### Git Operations

```bash
git add .
git commit -m "Release v1.0.5"
git tag ios-geistai-1.0.5
git push origin ios-crash
git push origin ios-geistai-1.0.5
```

### EAS Build

```bash
# Production build
eas build --platform ios --profile production

# Preview build
eas build --platform ios --profile preview
```

## 🐛 Troubleshooting

### Common Issues

1. **EAS not logged in**: `eas login`
2. **Build fails**: Check `eas build:list` for errors
3. **Version conflicts**: Ensure version is higher than previous
4. **Pod install fails**: Clean and reinstall pods

### Debug Commands

```bash
# Check EAS status
eas whoami

# View build logs
eas build:view [build-id]

# List all builds
eas build:list

# Check project status
eas project:info
```

## 📊 Release Checklist

### Before Release

- [ ] Code reviewed and tested
- [ ] Version number decided
- [ ] Changelog updated
- [ ] Backend deployed
- [ ] Local testing completed

### During Release

- [ ] Run release script
- [ ] Monitor build progress
- [ ] Check for build errors
- [ ] Download and test build

### After Release

- [ ] Upload to TestFlight
- [ ] Test on physical device
- [ ] Monitor for crashes
- [ ] Update release notes
- [ ] Submit to App Store (if production)

## 🎯 Best Practices

1. **Version Numbers**: Use semantic versioning (1.0.5, 1.1.0, 2.0.0)
2. **Testing**: Always test on physical device before release
3. **Backup**: Keep previous working versions
4. **Documentation**: Update changelog and release notes
5. **Monitoring**: Watch for crashes and user feedback

## 📞 Support

If you encounter issues with the release process:

1. **Check EAS Status**: https://status.expo.dev/
2. **View Build Logs**: `eas build:view [build-id]`
3. **Expo Documentation**: https://docs.expo.dev/
4. **EAS CLI Help**: `eas --help`

---

**Happy Releasing! 🚀**
