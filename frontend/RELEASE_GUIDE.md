# Release Guide for Geist AI

## Quick Commands Reference

```bash
# Build new version
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Check build status
eas build:list --platform ios --limit 5
```

## 📱 Pushing Updates to TestFlight Internal (100 testers)

### 1. Update Version Number
Edit `app.json`:
```json
"version": "1.0.1",  // Increment this
```

### 2. Build New Version
```bash
cd frontend
eas build --platform ios --profile production
```
Wait ~15-30 minutes for build to complete.

### 3. Submit to TestFlight
```bash
eas submit --platform ios --latest
```

### 4. Add to Internal Testing
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select **Geist AI** → **TestFlight** → **Internal Testing**
3. Click your test group
4. Under **Builds**, click **+**
5. Select the new build → **Add**

**Result**: Internal testers get update immediately, no review needed!

## 🌍 Pushing to TestFlight External (10,000 testers)

### 1. Follow Steps 1-3 Above
Build and submit the same way.

### 2. Submit for Beta Review
1. Go to **TestFlight** → **External Testing**
2. Create/select your external group
3. Click **+** to add build
4. Fill out **Test Information**:
   - What to test
   - Beta App Description
   - Email/Contact
5. Click **Submit for Beta App Review**

### 3. Wait for Review
- First submission: 24-48 hours
- Updates: Usually few hours
- You'll get email when approved

**Result**: External testers receive invite once approved.

## 🚀 Publishing to App Store

### Prerequisites
- App has been tested thoroughly
- All content/screenshots ready
- App Store listing prepared

### 1. Prepare for Production
Update `app.json`:
```json
"version": "1.1.0",  // Major version for App Store
```

### 2. Build Production Version
```bash
eas build --platform ios --profile production
```

### 3. Submit to App Store Connect
```bash
eas submit --platform ios --latest --non-interactive
```

### 4. Prepare App Store Listing
1. Go to **App Store Connect** → **Geist AI**
2. Click **App Store** tab
3. Fill out all sections:
   - **App Information**
   - **Pricing and Availability**
   - **App Privacy** (required!)
   - **Version Information**:
     - Screenshots (6.5", 5.5" required)
     - Description
     - Keywords
     - Support URL
     - Marketing URL

### 5. Select Build
1. In **Build** section, click **+**
2. Select your production build
3. Save

### 6. Submit for Review
1. Click **Add for Review**
2. Answer questions:
   - Export compliance (HTTPS only = Yes)
   - Content rights
   - Advertising identifier
3. Click **Submit to App Review**

### 7. App Review Process
- Timeline: 24-48 hours typically
- May take up to 7 days
- You'll get email updates
- Can expedite if critical

## 🔄 Version Management

### Version Numbering Strategy
- **1.0.x** - Bug fixes (1.0.1, 1.0.2)
- **1.x.0** - New features (1.1.0, 1.2.0)
- **x.0.0** - Major updates (2.0.0)

### Build Numbers
- Auto-incremented by EAS (`"autoIncrement": true`)
- Each build gets unique number
- Don't need to manage manually

## 📝 Update Checklist

### Before Each Release
- [ ] Test all features locally
- [ ] Update version in `app.json`
- [ ] Check API endpoints are correct
- [ ] Test on physical device
- [ ] Review crash reports/analytics

### For App Store Releases
- [ ] Update screenshots if UI changed
- [ ] Update description/keywords
- [ ] Review app privacy settings
- [ ] Prepare "What's New" text
- [ ] Test upgrade from previous version

## 🛠 Troubleshooting

### Build Failed
```bash
# View detailed logs
eas build:view [build-id]

# Clear cache and retry
eas build --clear-cache --platform ios
```

### Submission Failed
- Check Apple Developer account is active
- Verify agreements are signed
- Ensure no App Store Connect warnings

### TestFlight Not Updating
1. Check build was added to test group
2. Testers may need to refresh TestFlight app
3. Verify tester's device is compatible

## 🔑 Important URLs

- **EAS Dashboard**: https://expo.dev/accounts/rickkdev/projects/geist-v2
- **App Store Connect**: https://appstoreconnect.apple.com
- **TestFlight for Testers**: https://testflight.apple.com

## 📊 Monitoring

### Check Build History
```bash
eas build:list --platform ios --limit 10
```

### View Specific Build
```bash
eas build:view [build-id]
```

### Download Build
```bash
# Get .ipa file URL from build details
eas build:view [build-id]
```

## 🎯 Best Practices

1. **Test on TestFlight first** - Always test with internal group before external/App Store
2. **Increment versions properly** - Follow semantic versioning
3. **Keep release notes** - Document what changed in each version
4. **Monitor feedback** - Check TestFlight feedback and crash reports
5. **Plan releases** - Avoid Friday releases, plan for review time

## 🚨 Emergency Procedures

### Rollback a Release
1. Cannot rollback on App Store (must submit new version)
2. For TestFlight: Add previous build to test groups
3. Always keep 2-3 previous builds available

### Expedited Review
1. Go to App Store Connect
2. Contact → App Review → Request Expedited Review
3. Explain critical issue
4. Usually processed within 24 hours

## Configuration Files

### Current Setup
- **Bundle ID**: `im.geist.ios`
- **Team**: OpenQ Labs GmbH (2MU3JMSC5Y)
- **API**: https://api.geist.im
- **Project ID**: 37ee3bb2-75d7-46f2-8ec2-f48fbd02c1fa

---

**Ready to ship updates!** 🚀 Remember: Internal TestFlight = Instant, External = Review Required, App Store = Full Review