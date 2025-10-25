# Pricing Negotiation Implementation Guide

## 🎯 Overview

This document outlines the **complete pricing negotiation system** that has been implemented for GeistAI. The system allows non-premium users to engage in AI-powered pricing negotiations to find the perfect subscription plan.

## 🏗️ Architecture

### User Flow

```
App Launches
    ↓
Premium Check (usePremium hook)
    ↓
    ├─ User IS Premium
    │   ↓
    │   Show Normal Chat (Main App)
    │   Endpoint: /api/chat
    │
    └─ User NOT Premium
        ↓
        Show Negotiation Chat
        Endpoint: /api/negotiate
```

## 📁 File Structure

### Backend Files

```
backend/router/
├── revenuecat_auth.py          # RevenueCat authentication & premium verification
├── agent_tool.py               # Pricing agent creation (create_pricing_agent)
├── main.py                     # /api/negotiate endpoint
└── test_pricing.py             # Testing script
```

### Frontend Files

```
frontend/
├── lib/
│   ├── revenuecat.ts           # RevenueCat mock service
│   ├── api/chat.ts             # sendNegotiationMessage function
│   └── config/environment.ts   # API configuration
├── hooks/
│   └── usePremium.ts           # Premium status management
├── components/
│   ├── NegotiationChat.tsx      # Negotiation chat UI
│   ├── PriceNegotiationScreen.tsx # Pricing details screen
│   ├── PaywallScreen.tsx        # Paywall for premium features
│   └── PremiumGate.tsx          # Premium feature wrapper
└── app/
    └── index.tsx               # Main app with premium check
```

## 🔌 Backend Integration

### RevenueCat Authentication (`revenuecat_auth.py`)

Verifies if user has premium subscription and returns subscription status.

### Negotiation Endpoint (`main.py`)

POST /api/negotiate endpoint that requires X-User-ID header and returns Server-Sent Events stream.

### Pricing Agent (`agent_tool.py`)

Creates specialized pricing negotiation agent with:

- Understanding of user needs & budget
- Appropriate plan recommendations
- Negotiation based on usage patterns
- Personalized recommendations

## 🎨 Frontend Integration

### Premium Hook (`usePremium.ts`)

- isPremium: User has active subscription
- isLoading: Loading premium status
- checkPremiumStatus: Manual status check
- purchaseSubscription: Handle purchase
- restorePurchases: Restore old purchases

### Negotiation Chat (`NegotiationChat.tsx`)

Streaming chat interface that calls /api/negotiate endpoint

### Premium Gate (`PremiumGate.tsx`)

Wraps premium-only features and shows paywall if user isn't premium

## 🚀 How It Works

### App Launch

```typescript
export default function ChatScreen() {
  const { isPremium, isLoading: premiumLoading } = usePremium();

  // Wait for premium check
  if (premiumLoading) return <LoadingScreen />;

  // Non-premium users see negotiation
  if (!isPremium) return <NegotiationChat />;

  // Premium users see normal chat
  return <NormalChatInterface />;
}
```

## 📝 Implementation Status

### ✅ Completed

- [x] RevenueCat authentication backend
- [x] Pricing negotiation endpoint (/api/negotiate)
- [x] Pricing agent with negotiation prompts
- [x] Premium status hook (usePremium)
- [x] Negotiation chat component
- [x] Premium gate wrapper
- [x] App launch flow with premium check
- [x] Linting fixes and code formatting

### ⏳ Pending

- [ ] Configure actual RevenueCat SDK
- [ ] Backend dependency installation
- [ ] Full end-to-end testing
- [ ] Production deployment configuration
