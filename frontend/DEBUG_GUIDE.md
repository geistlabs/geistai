# 🐛 GeistAI Frontend Debug Guide

## Overview

This guide explains how to use the comprehensive debugging features added to the GeistAI frontend to
monitor responses, routing, and performance.

## 🚀 Quick Start

### 1. Enable Debug Mode

**Option A: Use Debug Screen**

```bash
# In your app, navigate to the debug version
# File: app/index-debug.tsx
```

**Option B: Enable in Normal App**

```typescript
// In your main app file, import debug hooks
import { useChatDebug } from '../hooks/useChatDebug';
import { DebugPanel } from '../components/chat/DebugPanel';
```

### 2. View Debug Information

The debug panel shows real-time information about:

- **Performance**: Connection time, first token time, total time, tokens/second
- **Routing**: Which model was used (llama/qwen_tools/qwen_direct)
- **Statistics**: Token count, chunk count, errors
- **Errors**: Any errors that occurred during the request

## 📊 Debug Information Explained

### Performance Metrics

| Metric               | Description                      | Good Values                          |
| -------------------- | -------------------------------- | ------------------------------------ |
| **Connection Time**  | Time to establish SSE connection | < 100ms                              |
| **First Token Time** | Time to receive first token      | < 500ms (simple), < 2000ms (tools)   |
| **Total Time**       | Complete response time           | < 3000ms (simple), < 15000ms (tools) |
| **Tokens/Second**    | Generation speed                 | > 20 tok/s                           |

### Routing Information

| Route         | Model        | Use Case                | Expected Time |
| ------------- | ------------ | ----------------------- | ------------- |
| `llama`       | Llama 3.1 8B | Simple/Creative queries | 2-3 seconds   |
| `qwen_tools`  | Qwen 2.5 32B | Weather/News/Search     | 10-15 seconds |
| `qwen_direct` | Qwen 2.5 32B | Complex reasoning       | 5-10 seconds  |

### Route Colors

- 🟢 **Green**: `llama` (fast, simple)
- 🟡 **Yellow**: `qwen_tools` (tools required)
- 🔵 **Blue**: `qwen_direct` (complex reasoning)
- ⚫ **Gray**: `unknown` (error state)

## 🔧 Debug Components

### 1. ChatAPIDebug

Enhanced API client with comprehensive logging:

```typescript
import { ChatAPIDebug } from '../lib/api/chat-debug';

const chatApi = new ChatAPIDebug(apiClient);

// Stream with debug info
await chatApi.streamMessage(
  message,
  onChunk,
  onError,
  onComplete,
  messages,
  onDebugInfo, // <- Debug info callback
);
```

### 2. useChatDebug Hook

Enhanced chat hook with debugging capabilities:

```typescript
import { useChatDebug } from '../hooks/useChatDebug';

const {
  messages,
  isLoading,
  isStreaming,
  error,
  sendMessage,
  debugInfo, // <- Debug information
  chatApi,
} = useChatDebug({
  onDebugInfo: info => {
    console.log('Debug info:', info);
  },
  debugMode: true,
});
```

### 3. DebugPanel Component

Visual debug panel showing real-time metrics:

```typescript
import { DebugPanel } from '../components/chat/DebugPanel';

<DebugPanel
  debugInfo={debugInfo}
  isVisible={showDebug}
  onToggle={() => setShowDebug(!showDebug)}
/>
```

## 📝 Debug Logging

### Console Logs

The debug system adds comprehensive console logging:

```
🚀 [ChatAPI] Starting stream message: {...}
🌐 [ChatAPI] Connecting to: http://localhost:8000/api/chat/stream
✅ [ChatAPI] SSE connection established: 45ms
⚡ [ChatAPI] First token received: 234ms
📦 [ChatAPI] Chunk 1: {...}
📊 [ChatAPI] Performance update: {...}
🏁 [ChatAPI] Stream completed: {...}
```

### Log Categories

- **🚀 API**: Request/response logging
- **🌐 Network**: Connection details
- **⚡ Performance**: Timing metrics
- **📦 Streaming**: Chunk processing
- **🎯 Routing**: Model selection
- **❌ Errors**: Error tracking

## 🎯 Debugging Common Issues

### 1. Slow Responses

**Symptoms**: High "Total Time" in debug panel **Check**:

- Route: Should be `llama` for simple queries
- First Token Time: Should be < 500ms
- Tool Calls: Should be 0 for simple queries

**Solutions**:

- Check if query is being misrouted to tools
- Verify model is running on correct port
- Check network latency

### 2. Routing Issues

**Symptoms**: Wrong route selected **Check**:

- Query content in console logs
- Route selection logic in backend
- Expected vs actual route

**Solutions**:

- Update query routing patterns
- Check query classification logic
- Verify model availability

### 3. Connection Issues

**Symptoms**: High connection time or errors **Check**:

- Connection Time: Should be < 100ms
- Error count in debug panel
- Network connectivity

**Solutions**:

- Check backend is running
- Verify API URL configuration
- Check firewall/network settings

### 4. Token Generation Issues

**Symptoms**: Low tokens/second or high token count **Check**:

- Tokens/Second: Should be > 20
- Token Count: Reasonable for query type
- Model performance

**Solutions**:

- Check model resource usage
- Verify GPU/CPU performance
- Consider model optimization

## 🔍 Advanced Debugging

### 1. Custom Debug Configuration

```typescript
import { DebugConfig } from '../lib/config/debug';

const customConfig: DebugConfig = {
  enabled: true,
  logLevel: 'debug',
  features: {
    api: true,
    streaming: true,
    routing: true,
    performance: true,
    errors: true,
    ui: false,
  },
  performance: {
    trackTokenCount: true,
    trackResponseTime: true,
    slowRequestThreshold: 3000,
  },
};
```

### 2. Performance Monitoring

```typescript
import { debugPerformance } from '../lib/config/debug';

// Track custom metrics
const startTime = Date.now();
// ... operation ...
debugPerformance('Custom Operation', {
  duration: Date.now() - startTime,
  operation: 'custom_operation',
});
```

### 3. Error Tracking

```typescript
import { debugError } from '../lib/config/debug';

try {
  // ... operation ...
} catch (error) {
  debugError('OPERATION', 'Operation failed', {
    error: error.message,
    stack: error.stack,
  });
}
```

## 📱 Mobile Debugging

### React Native Debugger

1. Install React Native Debugger
2. Enable network inspection
3. View console logs in real-time
4. Monitor performance metrics

### Flipper Integration

```typescript
// Add to your app for Flipper debugging
import { logger } from '../lib/config/debug';

// Logs will appear in Flipper console
logger.info('APP', 'App started');
```

## 🚨 Troubleshooting

### Debug Panel Not Showing

1. Check `isDebugPanelVisible` state
2. Verify DebugPanel component is imported
3. Check console for errors

### No Debug Information

1. Ensure `debugMode: true` in useChatDebug
2. Check debug configuration is enabled
3. Verify API is returning debug data

### Performance Issues

1. Check if debug logging is causing slowdown
2. Reduce log level to 'warn' or 'error'
3. Disable unnecessary debug features

## 📚 Files Reference

| File                             | Purpose                          |
| -------------------------------- | -------------------------------- |
| `lib/api/chat-debug.ts`          | Enhanced API client with logging |
| `hooks/useChatDebug.ts`          | Debug-enabled chat hook          |
| `components/chat/DebugPanel.tsx` | Visual debug panel               |
| `lib/config/debug.ts`            | Debug configuration              |
| `app/index-debug.tsx`            | Debug-enabled main screen        |

## 🎉 Benefits

Using the debug features helps you:

- **Monitor Performance**: Track response times and identify bottlenecks
- **Debug Routing**: Verify queries are routed to correct models
- **Track Errors**: Identify and fix issues quickly
- **Optimize UX**: Ensure fast, reliable responses
- **Validate Architecture**: Confirm multi-model setup is working

The debug system provides comprehensive visibility into your GeistAI frontend, making it easy to
identify and resolve issues quickly! 🚀
