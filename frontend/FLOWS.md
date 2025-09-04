# Data Flows - Geist v2 Frontend

## Current Message Flow (Mock)
```
User Input → handleSend() → Create Message Object → Update State → Mock Response → Display
```

### Data Shape
```typescript
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
```

## Planned API Flow (Session 3)
```
User Input → API Client → Backend Stream → Parse Chunks → Update UI → Store Message
```

### Planned Stream Processing
1. User sends message
2. Create API request with message
3. Open SSE connection to backend
4. Parse streaming chunks (harmony format)
5. Update message content progressively
6. Handle errors/retries
7. Store final message

## Component Data Flow
```
ChatScreen (state owner)
  ├── MessageBubble (display only)
  └── Input Bar (sends events up)
```

## Backend Integration Points
- `/api/chat/completions` - Streaming endpoint
- Harmony format parsing for chunks
- Error boundaries for network failures