# 🐛 Frontend Debug Features Summary

## 🎯 Overview

I've added comprehensive debugging capabilities to your GeistAI frontend to help monitor responses, routing, and performance. This gives you real-time visibility into how your multi-model architecture is performing.

## 📁 New Files Created

### Core Debug Components

- **`lib/api/chat-debug.ts`** - Enhanced API client with comprehensive logging
- **`hooks/useChatDebug.ts`** - Debug-enabled chat hook with performance tracking
- **`components/chat/DebugPanel.tsx`** - Visual debug panel showing real-time metrics
- **`lib/config/debug.ts`** - Debug configuration and logging utilities

### Debug Screens & Scripts

- **`app/index-debug.tsx`** - Debug-enabled main chat screen
- **`scripts/switch-debug-mode.js`** - Easy script to switch between debug/normal modes
- **`DEBUG_GUIDE.md`** - Comprehensive guide for using debug features

## 🚀 How to Use

### Option 1: Quick Switch (Recommended)

```bash
cd frontend

# Enable debug mode
node scripts/switch-debug-mode.js debug

# Check current mode
node scripts/switch-debug-mode.js status

# Switch back to normal
node scripts/switch-debug-mode.js normal
```

### Option 2: Manual Integration

```typescript
// In your main app file
import { useChatDebug } from '../hooks/useChatDebug';
import { DebugPanel } from '../components/chat/DebugPanel';

const { debugInfo, ... } = useChatDebug({
  onDebugInfo: (info) => console.log('Debug:', info),
  debugMode: true,
});

<DebugPanel debugInfo={debugInfo} isVisible={showDebug} onToggle={toggleDebug} />
```

## 📊 Debug Information Available

### Real-Time Metrics

- **Connection Time**: How long to establish SSE connection
- **First Token Time**: Time to receive first response token
- **Total Time**: Complete response time
- **Tokens/Second**: Generation speed
- **Token Count**: Total tokens in response
- **Chunk Count**: Number of streaming chunks

### Routing Information

- **Route**: Which model was selected (`llama`/`qwen_tools`/`qwen_direct`)
- **Model**: Actual model being used
- **Tool Calls**: Number of tool calls made
- **Route Colors**: Visual indicators for different routes

### Error Tracking

- **Error Count**: Number of errors encountered
- **Error Details**: Specific error messages
- **Error Categories**: Network, parsing, streaming errors

## 🎨 Debug Panel Features

### Visual Interface

- **Collapsible Sections**: Performance, Routing, Statistics, Errors
- **Color-Coded Routes**: Green (llama), Yellow (tools), Blue (direct)
- **Real-Time Updates**: Live metrics as responses stream
- **Error Highlighting**: Clear error indicators

### Performance Monitoring

- **Timing Metrics**: Connection, first token, total time
- **Speed Metrics**: Tokens per second
- **Progress Tracking**: Token count updates
- **Slow Request Detection**: Highlights slow responses

## 📝 Console Logging

### Enhanced Logging

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

## 🔍 Debugging Common Issues

### 1. Slow Responses

**Check**: Total time, first token time, route
**Expected**: < 3s for simple, < 15s for tools
**Solutions**: Check routing, model performance

### 2. Wrong Routing

**Check**: Route selection, query classification
**Expected**: `llama` for simple, `qwen_tools` for weather/news
**Solutions**: Update routing patterns

### 3. Connection Issues

**Check**: Connection time, error count
**Expected**: < 100ms connection time
**Solutions**: Check backend, network

### 4. Token Generation Issues

**Check**: Tokens/second, token count
**Expected**: > 20 tok/s, reasonable token count
**Solutions**: Check model performance

## 🎯 Performance Benchmarks

| Query Type        | Route         | Expected Time | Expected Tokens/s |
| ----------------- | ------------- | ------------- | ----------------- |
| Simple Greeting   | `llama`       | < 3s          | > 30              |
| Creative Query    | `llama`       | < 3s          | > 30              |
| Weather Query     | `qwen_tools`  | < 15s         | > 20              |
| News Query        | `qwen_tools`  | < 15s         | > 20              |
| Complex Reasoning | `qwen_direct` | < 10s         | > 25              |

## 🔧 Configuration Options

### Debug Levels

```typescript
const debugConfig = {
  enabled: true,
  logLevel: "debug", // none, error, warn, info, debug
  features: {
    api: true,
    streaming: true,
    routing: true,
    performance: true,
    errors: true,
    ui: false,
  },
};
```

### Performance Tracking

```typescript
const performanceConfig = {
  trackTokenCount: true,
  trackResponseTime: true,
  trackMemoryUsage: false,
  logSlowRequests: true,
  slowRequestThreshold: 5000, // milliseconds
};
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

## 📱 Mobile Debugging

### React Native Debugger

- View console logs in real-time
- Monitor network requests
- Inspect component state

### Flipper Integration

- Advanced debugging capabilities
- Network inspection
- Performance profiling

## 🎉 Benefits

Using these debug features helps you:

- **Monitor Performance**: Track response times and identify bottlenecks
- **Debug Routing**: Verify queries are routed to correct models
- **Track Errors**: Identify and fix issues quickly
- **Optimize UX**: Ensure fast, reliable responses
- **Validate Architecture**: Confirm multi-model setup is working

## 🔄 Quick Commands

```bash
# Switch to debug mode
node scripts/switch-debug-mode.js debug

# Check current mode
node scripts/switch-debug-mode.js status

# Switch back to normal
node scripts/switch-debug-mode.js normal

# View debug guide
cat DEBUG_GUIDE.md
```

## 📚 Files Reference

| File                             | Purpose                          |
| -------------------------------- | -------------------------------- |
| `lib/api/chat-debug.ts`          | Enhanced API client with logging |
| `hooks/useChatDebug.ts`          | Debug-enabled chat hook          |
| `components/chat/DebugPanel.tsx` | Visual debug panel               |
| `lib/config/debug.ts`            | Debug configuration              |
| `app/index-debug.tsx`            | Debug-enabled main screen        |
| `scripts/switch-debug-mode.js`   | Mode switching script            |
| `DEBUG_GUIDE.md`                 | Comprehensive usage guide        |

Your GeistAI frontend now has comprehensive debugging capabilities to monitor and optimize your multi-model architecture! 🚀
