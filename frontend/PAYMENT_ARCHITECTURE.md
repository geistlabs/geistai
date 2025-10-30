# GeistAI Payment Architecture & Deployment Guide

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Pricing Model](#pricing-model)
3. [User Flow](#user-flow)
4. [TestFlight Deployment](#testflight-deployment)
5. [Employee/Internal Testing](#employee--internal-testing)
6. [Production Deployment](#production-deployment)

## Architecture Overview

### Tech Stack

- **RevenueCat**: Subscription management & validation
- **React Native Purchases**: Client SDK integration
- **Apple StoreKit**: Native iOS subscription handling
- **TanStack Query**: Subscription state management
- **LLM Price Negotiation**: Backend pricing agent [[memory:10319067]]

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                     User Experience                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Free User → Negotiation Mode → Pricing Card → Paywall     │
│     │                                                       │
│     └→ Premium User → Full Chat Access                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React Native)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • useRevenueCat() hook - subscription state               │
│  • PaywallModal - subscription purchase UI                 │
│  • PricingCard - negotiation result display                │
│  • ChatScreen - premium gating logic                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    RevenueCat SDK                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Manages subscriptions                                    │
│  • Validates receipts                                       │
│  • Provides offerings                                       │
│  • Grants entitlements                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   Apple StoreKit                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Handles actual payments                                  │
│  • Sandbox (testing)                                        │
│  • Production (live)                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Pricing Model

### Current Subscription Tiers

**Monthly Subscription:**

- **Product ID**: `premium_monthly_10`
- **Price**: $9.99/month
- **Offerings**: Display varies based on negotiation

**Annual Subscription:**

- **Product ID**: `premium_yearly_10`
- **Price**: $95.99/year (20% savings)
- **Value**: ~$8/month effective price

### Archived Pricing Tiers (from your logs)

- `premium_monthly_20` - $19.99/month
- `premium_monthly_30` - $29.99/month
- `premium_monthly_40` - $39.99/month

These appear to be historical test tiers. Current active products are the $9.99 monthly and $95.99
yearly subscriptions.

## User Flow

### 1. Free User Experience

```typescript
// Chat mode determination in index.tsx
const activeChatMode: 'streaming' | 'negotiation' =
  isPremium === true ? 'streaming' : 'negotiation';
```

**Non-premium users:**

1. Start chat conversation
2. Backend routes to `/api/negotiate` endpoint
3. Pricing agent engages in price negotiation [[memory:10319067]]
4. PricingCard displays negotiated options
5. User taps "Upgrade →" button
6. PaywallModal opens with subscription options

### 2. Price Negotiation Flow

The negotiation uses an LLM-based pricing agent that:

- Understands user needs and budget
- Presents pricing options
- Can negotiate within bounds ($9.99-$39.99 originally, now fixed at $9.99)
- Calls `finalize_negotiation` with recommended price

### 3. Purchase Flow

```typescript
// User purchases subscription
handlePurchase(package) →
  useRevenueCat.purchase() →
    RevenueCat SDK →
      Apple StoreKit →
        Payment processed →
          RevenueCat validates →
            Entitlement granted
```

### 4. Premium Access

```typescript
// Premium check in useRevenueCat
hasActiveEntitlement('premium') → boolean
```

Once premium:

- Chat mode switches to `'streaming'`
- Full access to AI agents and features
- Entitlement persists across devices

## TestFlight Deployment

### Step 1: Configure App Store Connect

1. **Create Products in App Store Connect:**
   - In-App Purchases → Subscriptions
   - Create subscription group "Geist Premium"
   - Add products:
     - `premium_monthly_10` - $9.99/month
     - `premium_yearly_10` - $95.99/year

2. **Configure Product Details:**
   - Pricing: Match your target countries/regions
   - Subscription Duration: Monthly and Annual
   - Free Trial: Optional (recommend 7-day free trial)
   - Family Sharing: Enable if desired

3. **Privacy & Legal:**
   - Subscription Terms
   - Privacy Policy URL
   - Terms of Use URL

### Step 2: Configure RevenueCat for TestFlight

1. **Products:**
   - Add same Product IDs from App Store Connect
   - Configure as "App Store" products (not web billing)
   - Link to entitlements

2. **Offerings:**
   - Create "premium_monthly_10" offering
   - Attach monthly and annual packages
   - Set as current offering

3. **Entitlements:**
   - Create "premium" entitlement
   - Map to subscriptions

### Step 3: Environment Configuration

Your app already handles environment switching:

```typescript
// frontend/lib/revenuecat.ts
const getRevenueCatKeys = () => {
  const isProduction = !__DEV__;

  if (useTestEnvironment) {
    return {
      apple: process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY,
      isTest: true,
    };
  } else {
    return {
      apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY,
      isTest: false,
    };
  }
};
```

**For TestFlight:**

- Use **TEST** API keys (still sandbox environment)
- TestFlight uses App Store Sandbox for purchases
- Employees will be sandbox testers

### Step 4: Build and Upload

```bash
# Build for TestFlight
cd frontend
npm run ios  # or use EAS Build

# Upload to TestFlight via Xcode or EAS
eas build --platform ios --profile preview
eas submit --platform ios
```

### Step 5: Configure TestFlight Sandbox Testers

1. **App Store Connect → Users and Access → Sandbox Testers**
2. **Add Testers:**
   - Email address
   - Password
   - First/Last Name
3. **Testers receive email** with sandbox account details
4. **Employees install app** from TestFlight
5. **Sign in with sandbox account** when prompted during purchase

## Employee / Internal Testing

### Option 1: Sandbox Test Accounts (Recommended)

**Pros:**

- Uses real StoreKit flow
- Validates entire purchase pipeline
- No code changes needed
- Tests actual subscription lifecycle

**Cons:**

- Employees need separate sandbox Apple IDs
- Sandbox purchases don't work on real device with real Apple ID

**Setup:**

1. Create sandbox test accounts for employees
2. Share login credentials securely
3. Employees install TestFlight build
4. When prompted, use sandbox Apple ID
5. Purchases are simulated but test entire flow

### Option 2: Promo Codes (For Small Team)

**Pros:**

- Free access for testing
- Works with production subscriptions

**Cons:**

- Limited availability
- Need to distribute codes
- Not good for ongoing testing

**Setup:**

1. Generate promo codes in App Store Connect
2. Distribute to employees
3. Employees redeem in App Store
4. Free access granted

### Option 3: Internal Entitlement Grant (Not Recommended)

**Pros:**

- Complete bypass of payment system
- Full control

**Cons:**

- Requires code changes
- Bypasses entire payment testing
- Not representative of real user experience

### Recommendation: Use Sandbox + Developer Control Grant

**Best Approach:**

1. Use sandbox accounts for normal testing
2. Manually grant entitlements in RevenueCat dashboard for quick tests
3. This gives you:
   - Real payment flow testing (sandbox)
   - Quick iteration (dashboard grants)

**Manual Grant in RevenueCat:**

1. RevenueCat Dashboard → Customers
2. Find employee's customer ID
3. Grant "premium" entitlement
4. Employee gets instant access (bypasses payment)
5. Can test features without sandbox limitations

## Production Deployment

### Pre-Launch Checklist

#### 1. App Store Connect

- [ ] Products created and configured
- [ ] Pricing set for all regions
- [ ] Subscription group configured
- [ ] Privacy policy and terms uploaded
- [ ] Screenshots and metadata ready
- [ ] App Review information complete

#### 2. RevenueCat Dashboard

- [ ] Production API keys configured
- [ ] Products linked to entitlements
- [ ] Offerings configured
- [ ] Web notifications configured (optional)
- [ ] Analytics enabled

#### 3. Environment Configuration

- [ ] Production API keys in environment variables
- [ ] Environment flags configured correctly
- [ ] Logging level set to ERROR for production
- [ ] No debug UI elements (like DevResetButton)

#### 4. Testing

- [ ] Sandbox testing complete
- [ ] TestFlight testing with real users
- [ ] Purchase flow validated
- [ ] Restore purchases tested
- [ ] Subscription renewal tested
- [ ] Cancellation flow tested

### Launch Day

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Review
eas submit --platform ios

# Monitor submissions
eas build:list
```

### Post-Launch Monitoring

1. **RevenueCat Dashboard:**
   - Monitor active subscriptions
   - Track conversion rates
   - View revenue metrics

2. **Apple App Store:**
   - Review ratings and feedback
   - Monitor subscription issues
   - Track subscription cancellations

3. **Analytics:**
   - Track paywall views
   - Monitor purchase completion rates
   - Measure subscription retention

## Key Files & Code

### Frontend

- `frontend/lib/revenuecat.ts` - RevenueCat SDK integration
- `frontend/hooks/useRevenueCat.ts` - Subscription state management
- `frontend/components/paywall/PaywallModal.tsx` - Purchase UI
- `frontend/components/PricingCard.tsx` - Negotiation result display
- `frontend/app/index.tsx` - Premium gating logic

### Backend

- `backend/router/agent_tool.py` - Pricing agent configuration
- `backend/router/main.py` - `/api/negotiate` endpoint

### Configuration

- `frontend/ios/configurationTest.storekit` - StoreKit test config
- `frontend/ios/STOREKIT_SETUP.md` - StoreKit setup guide

## Environment Variables

```bash
# Development (local)
EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY=your_test_key

# Production (App Store)
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=your_production_key
```

## Best Practices

1. **Always test purchase flows** before App Review
2. **Monitor subscription health** metrics daily
3. **Handle edge cases:**
   - Network failures during purchase
   - Subscription renewal failures
   - Restore purchases from new device
4. **Provide clear messaging:**
   - Subscription terms clearly stated
   - Easy cancellation process
   - Support contact information
5. **Compliance:**
   - Follow App Store subscription guidelines
   - Display pricing clearly
   - Handle subscription restoration

## Support Resources

- **RevenueCat Docs**: https://docs.revenuecat.com
- **Apple IAP Docs**: https://developer.apple.com/in-app-purchase/
- **TestFlight Guide**: https://developer.apple.com/testflight/
- **StoreKit Testing**: https://developer.apple.com/documentation/storekit

## Next Steps

1. ✅ Configure products in App Store Connect
2. ✅ Set up RevenueCat for production
3. 🔲 Test with TestFlight sandbox accounts
4. 🔲 Create employee sandbox test accounts
5. 🔲 Validate purchase flows end-to-end
6. 🔲 Submit to App Review
