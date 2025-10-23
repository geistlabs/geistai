# Server-Side Premium Verification

## Overview

This document describes the server-side premium verification system implemented to protect GeistAI's expensive API endpoints from unauthorized access.

## Architecture

```
Mobile App → X-User-ID Header → Backend → RevenueCat API → Verify Premium → Allow/Deny
```

## Protected Endpoints

### ✅ Premium Required
- `POST /api/stream` - Main chat/AI streaming (costs money)
- `POST /api/speech-to-text` - Audio transcription (costs money)
- `POST /embeddings/embed` - Text embeddings (costs money)

### ⚪ Public (No Premium)
- `GET /health` - Health check
- `GET /ssl/info` - SSL information
- `GET /api/tools` - Tool listing

## Implementation Details

### Backend Files

#### `backend/router/revenuecat_auth.py`
Core verification module containing:
- `RevenueCatVerifier` class - Handles API calls to RevenueCat
- `require_premium()` - FastAPI dependency for endpoint protection
- `get_user_id()` - Optional dependency for user tracking

**Key Features:**
- Fail-open strategy (allows access if RevenueCat API is down)
- 10-second timeout for API calls
- Proper error logging
- Returns 401 for missing headers, 403 for non-premium users

#### `backend/router/config.py`
Added configuration:
```python
REVENUECAT_API_KEY = os.getenv("REVENUECAT_API_KEY", "")
REVENUECAT_API_URL = "https://api.revenuecat.com/v1"
PREMIUM_ENTITLEMENT_ID = "premium"
```

#### `backend/router/main.py`
Updated endpoints to use premium verification:
```python
from revenuecat_auth import require_premium

@app.post("/api/stream")
async def stream_with_orchestrator(
    chat_request: ChatRequest,
    request: Request,
    user_id: str = Depends(require_premium)  # ← Protection
):
    logger.info(f"[Premium User: {user_id}] Processing chat request")
    # ... existing code
```

### Frontend Files

#### `frontend/lib/api.ts`
Centralized API helper with automatic authentication:
```typescript
export async function fetchWithAuth(endpoint: string, options?: RequestInit)
export async function sendChatMessage(message: string, history: any[])
export async function transcribeAudio(audioUri: string, language?: string)
export async function createEmbeddings(text: string)
```

**Features:**
- Automatically includes X-User-ID header
- Handles PREMIUM_REQUIRED errors
- Type-safe API calls

#### `frontend/lib/revenuecat.ts`
Added method:
```typescript
async getAppUserId(): Promise<string>
```

## Setup Instructions

### 1. Get RevenueCat API Key

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to: Project Settings → API Keys
3. Copy the **Secret API Key** (starts with `sk_`)

### 2. Configure Backend

Add to `backend/.env`:
```bash
REVENUECAT_API_KEY=sk_your_secret_api_key_here
```

### 3. Test Verification

Run the test script:
```bash
cd backend/router
source .venv/bin/activate
python ../test_premium_verification.py
```

**Expected output:**
- ✅ 401 for missing X-User-ID header
- ✅ 403 for non-premium users
- ✅ 200 for premium users

## Usage Examples

### Backend Protection

```python
# Protect any endpoint
@app.post("/api/expensive-operation")
async def expensive_operation(
    user_id: str = Depends(require_premium)
):
    # Only premium users can reach here
    logger.info(f"[Premium User: {user_id}] Processing request")
    return {"result": "success"}
```

### Frontend API Calls

```typescript
import { sendChatMessage } from '@/lib/api';

try {
  const response = await sendChatMessage("Hello AI!", []);
  // Handle response...
} catch (error) {
  if (error.message === 'PREMIUM_REQUIRED') {
    // Show paywall
    Alert.alert('Premium Required', 'Subscribe to continue');
  }
}
```

## Security Benefits

✅ **Server-Side Verification**: Users cannot bypass premium by hacking the app  
✅ **Cost Protection**: Only premium users can call expensive AI endpoints  
✅ **Reliable**: Server verifies with RevenueCat on every request  
✅ **Graceful Degradation**: Fails open if RevenueCat is down (doesn't block users)  
✅ **Logging**: Track premium vs free usage in logs  

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Premium verified, proceed |
| 401 | Unauthorized | Missing X-User-ID header |
| 403 | Forbidden | User doesn't have premium |
| 502 | Bad Gateway | RevenueCat API error (fails open) |

### Fail-Open Strategy

If the RevenueCat API is unavailable, the system **fails open** (allows access) to prevent blocking legitimate premium users. This is configurable:

```python
# In revenuecat_auth.py
# Change from:
return True  # Fail open

# To:
return False  # Fail closed (stricter)
```

## Logging

All premium verification attempts are logged:

```
✅ Premium verified for: $RCAnonymousID:xxx
❌ No premium for: $RCAnonymousID:xxx
❌ User not found: $RCAnonymousID:xxx
⚠️  Premium check skipped - no API key
⚠️  RevenueCat API timeout - failing open
```

## Testing

### Manual Testing

```bash
# Test without header (should fail with 401)
curl -X POST http://localhost:8000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Test with non-premium user (should fail with 403)
curl -X POST http://localhost:8000/api/stream \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test_user_123" \
  -d '{"message": "Hello"}'

# Test with premium user (should succeed)
curl -X POST http://localhost:8000/api/stream \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $RCAnonymousID:your-premium-user-id" \
  -d '{"message": "Hello"}'
```

### Automated Testing

Run the test script:
```bash
python backend/test_premium_verification.py
```

## Next Steps

### Immediate
- [ ] Add RevenueCat API key to production environment
- [ ] Test with real production user IDs
- [ ] Monitor logs for verification failures

### High Priority
- [ ] Set up RevenueCat webhooks for real-time updates
- [ ] Add database caching for premium status
- [ ] Implement rate limiting per user

### Medium Priority
- [ ] Add analytics for premium vs free usage
- [ ] Set up alerts for verification failures
- [ ] Add admin dashboard for subscription management

## Troubleshooting

### Issue: All requests are allowed (no verification)
**Solution:** Check if `REVENUECAT_API_KEY` is set in `.env`

### Issue: All requests return 403
**Solution:** Verify the API key is correct and has proper permissions

### Issue: Intermittent 502 errors
**Solution:** RevenueCat API might be slow/down. Check fail-open strategy.

### Issue: Frontend not sending X-User-ID
**Solution:** Ensure using `fetchWithAuth()` from `lib/api.ts`

## Resources

- [RevenueCat API Documentation](https://docs.revenuecat.com/reference/basic)
- [FastAPI Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [RevenueCat Dashboard](https://app.revenuecat.com/)

## Commit History

- `f89dbfa` - feat: Add server-side premium verification with RevenueCat
- `a1308aa` - feat: Add AI-powered dynamic pricing with negotiation flow

