# RevenueCat + TestFlight Setup Guide

## Common Issue: Products Not Showing in TestFlight

If you're seeing "0 products" or "offerings empty" errors in TestFlight, follow this checklist:

---

## ✅ Step 1: Verify App Store Connect Products

### 1.1 Check Product Status
Go to **App Store Connect → Your App → In-App Purchases → Subscriptions**

**Required checks:**
- [ ] Products exist: `premium_monthly_10` and `premium_yearly_10`
- [ ] Products are in **"Ready to Submit"** or **"Approved"** status
- [ ] Products are NOT in "Waiting for Review" or "Rejected" status
- [ ] Subscription group is created and both products are in the same group

### 1.2 Product Details
For each product, verify:
- [ ] **Product ID** matches exactly: `premium_monthly_10` / `premium_yearly_10`
- [ ] **Reference Name** is set (e.g., "Premium Monthly")
- [ ] **Price** is configured for your target countries
- [ ] **Subscription Duration** is correct (Monthly = 1 month, Yearly = 1 year)
- [ ] **Localization** is set (name and description in English at minimum)

### 1.3 Submission Status
- [ ] If products are new, they need to be **submitted with your app** OR **approved separately**
- [ ] Products must be approved before they work in TestFlight
- [ ] Check "Status" column - should show green checkmark

**⚠️ Important:** Products in "Waiting for Review" or "Developer Action Needed" won't work in TestFlight!

---

## ✅ Step 2: Verify RevenueCat Dashboard

### 2.1 Products Configuration
Go to **RevenueCat Dashboard → Products**

**Required checks:**
- [ ] Products are added: `premium_monthly_10` and `premium_yearly_10`
- [ ] Store is set to **"App Store"** (not "Web Billing")
- [ ] Product IDs match **exactly** with App Store Connect (case-sensitive)
- [ ] No typos or extra spaces in product IDs

### 2.2 Entitlements
Go to **RevenueCat Dashboard → Entitlements**

**Required checks:**
- [ ] Entitlement `premium` exists
- [ ] Both products are attached to the `premium` entitlement
- [ ] Entitlement is active (not archived)

### 2.3 Offerings
Go to **RevenueCat Dashboard → Offerings**

**Required checks:**
- [ ] An offering exists (e.g., "default" or "premium")
- [ ] Offering is set as **"Current Offering"** (star icon)
- [ ] Packages are created within the offering:
  - Monthly package points to `premium_monthly_10`
  - Annual package points to `premium_yearly_10`
- [ ] Package types are set correctly (MONTHLY, ANNUAL)

**⚠️ Critical:** If no offering is marked as "current", RevenueCat won't return any offerings!

---

## ✅ Step 3: Verify API Keys

### 3.1 Check Environment
Your app uses different keys for test vs production:

**TestFlight uses PRODUCTION keys** (even though it's testing):
- [ ] `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` is set in your build
- [ ] This should be the **Production API Key** from RevenueCat (starts with `appl_`)

**For local development:**
- [ ] `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` can be used (starts with `test_` or `appl_`)

### 3.2 Get Correct API Keys
1. Go to **RevenueCat Dashboard → Project Settings → API Keys**
2. Copy the **Apple App Store API Key** (production key)
3. Verify it starts with `appl_` (not `test_`)

### 3.3 Environment Variables
Check your build configuration:
```bash
# For TestFlight/Production builds
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_xxxxxxxxxxxxx

# For local development/testing
EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY=appl_xxxxxxxxxxxxx
```

**⚠️ Important:** TestFlight requires production API keys, even for testing!

---

## ✅ Step 4: Verify Product IDs Match

Product IDs must match **exactly** in all three places:

1. **App Store Connect** → Product ID: `premium_monthly_10`
2. **RevenueCat Dashboard** → Products → Product ID: `premium_monthly_10`
3. **Your Code** → Any references to product IDs

**Common mistakes:**
- ❌ `Premium_Monthly_10` (wrong case)
- ❌ `premium-monthly-10` (wrong separator)
- ❌ `premium_monthly_10 ` (extra space)
- ✅ `premium_monthly_10` (correct)

---

## ✅ Step 5: TestFlight-Specific Requirements

### 5.1 App Status
- [ ] Your app must be **submitted to App Store Connect** (even if not approved)
- [ ] Subscription products must be **attached to the app version**
- [ ] Build must be uploaded to TestFlight

### 5.2 Sandbox Tester Account
- [ ] Create a sandbox tester in App Store Connect
- [ ] Sign out of App Store on your test device
- [ ] Sign in with sandbox tester when prompted during purchase

### 5.3 StoreKit Configuration (for local testing only)
- [ ] StoreKit config file (`configurationTest.storekit`) is for **Xcode only**
- [ ] TestFlight **does NOT use** StoreKit config files
- [ ] TestFlight uses **real App Store Connect products**

---

## ✅ Step 6: Debugging Checklist

### Check Logs
Look for these in your TestFlight logs:

**Good signs:**
```
✅ [RevenueCat] Offerings fetched successfully
📦 [RevenueCat] Available packages: 2
```

**Bad signs:**
```
❌ [RevenueCat] Error fetching offerings
❌ Parsing 0 products in response
```

### Common Error Messages

**"None of the products registered in the RevenueCat dashboard could be fetched":**
- Products don't exist in App Store Connect
- Products aren't approved
- Wrong API key (using test key in production)
- Product IDs don't match

**"No current offering found":**
- No offering is set as "current" in RevenueCat
- Offering exists but has no packages attached

**"Products are empty":**
- Products exist but aren't approved in App Store Connect
- Products are in wrong subscription group
- API key is wrong environment

---

## ✅ Step 7: Quick Verification Steps

### Step 7.1: Verify RevenueCat Can See Products
1. Go to RevenueCat Dashboard → Products
2. Click on `premium_monthly_10`
3. Check "Store" field - should show "App Store"
4. Check "Status" - should show product details from App Store Connect

If product shows "Not found" or "Error fetching", the product doesn't exist in App Store Connect.

### Step 7.2: Verify Offering Configuration
1. Go to RevenueCat Dashboard → Offerings
2. Check which offering is marked as "Current" (star icon)
3. Click on the current offering
4. Verify packages are listed:
   - Monthly package → `premium_monthly_10`
   - Annual package → `premium_yearly_10`

### Step 7.3: Test API Key
Add this to your app temporarily to verify key:

```typescript
// In revenuecat.ts, add after Purchases.configure()
const customerInfo = await Purchases.getCustomerInfo();
console.log('✅ RevenueCat initialized for user:', customerInfo.originalAppUserId);
```

If this fails, your API key is wrong.

---

## 🔧 Common Fixes

### Fix 1: Products Not Approved
**Problem:** Products are in "Waiting for Review"
**Solution:**
- Submit products for review in App Store Connect
- Or use products that are already approved

### Fix 2: Wrong API Key
**Problem:** Using test key in TestFlight
**Solution:**
- Use production API key (`EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`)
- Remove test key from production builds

### Fix 3: No Current Offering
**Problem:** No offering marked as "current" in RevenueCat
**Solution:**
- Go to RevenueCat Dashboard → Offerings
- Click star icon on your offering to make it current

### Fix 4: Product ID Mismatch
**Problem:** IDs don't match exactly
**Solution:**
- Verify IDs match in App Store Connect, RevenueCat, and code
- Check for case sensitivity, spaces, typos

### Fix 5: Products Not Attached to App
**Problem:** Products exist but aren't linked to your app version
**Solution:**
- In App Store Connect, add products to your app version
- Make sure products are in the same subscription group

---

## 📋 Final Checklist Before Testing

Before testing in TestFlight, verify:

- [ ] Products exist in App Store Connect with correct IDs
- [ ] Products are approved or ready to submit
- [ ] Products are added to RevenueCat with correct IDs
- [ ] Products are attached to entitlement in RevenueCat
- [ ] Offering is created and set as "current" in RevenueCat
- [ ] Packages are created in offering with correct product references
- [ ] Production API key is set in build configuration
- [ ] App is uploaded to TestFlight
- [ ] Sandbox tester account is created

---

## 🆘 Still Not Working?

If products still don't show after all checks:

1. **Wait 24 hours** - App Store Connect changes can take time to propagate
2. **Check RevenueCat Status Page** - https://status.revenuecat.com
3. **Verify App Store Connect Status** - Products may be pending review
4. **Check RevenueCat Logs** - Dashboard → Project Settings → Logs
5. **Contact RevenueCat Support** - They can check your configuration

---

## 📚 Additional Resources

- RevenueCat Docs: https://www.revenuecat.com/docs
- App Store Connect Help: https://help.apple.com/app-store-connect/
- RevenueCat Troubleshooting: https://www.revenuecat.com/docs/troubleshooting





