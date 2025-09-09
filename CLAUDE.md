# Geist-v2 Development Todo List

## Core Principles

- Most important: Us `geist/frontend` as reference for all patterns
- Explain before coding
- Keep it production-ready
- Always style with tailwind/ nativwind

## Todo List

### ✅ Completed

#### Session 1: Foundations & Walking Skeleton

- [x] Project setup with Expo
- [x] Routing configuration
- [x] Tailwind/NativeWind styling

#### Session 2: Chat UI Components

- [x] MessageBubble component
- [x] InputBar component
- [x] Chat screen layout

#### Session 3: Backend Integration

- [x] Create `lib/api/client.ts` for HTTP client
- [x] Create `lib/api/chat.ts` for chat endpoints
- [x] Create `hooks/useChat.ts` for chat state management
- [x] Implement SSE/streaming with react-native-sse (fixed React Native streaming issue)
- [x] Add timeouts/retries/cancellation
- [x] Add network status UI
- [x] Add logs for start/stop stream, token count, errors
- [x] Implement real-time token rendering during stream
- [x] Add retry mechanism for failed messages

### 🔲 State & Persistence

- [ ] Mirror reference project's state approach
- [ ] Add multiple chat sessions

### 🔲 Advanced UX & Performance

- [ ] Add drawer/navigation patterns (if in reference)
- [ ] Add haptics (if in reference)
- [ ] Add lazy loading
- [ ] Add caching
- [ ] Add pin/favorite chats
- [ ] Add share/copy options
- [ ] Optimize bundle and memory per reference practices

### 🔲 Polish & Production

- [ ] Add icons/splash
- [ ] Add crash reporting
- [ ] Add analytics
- [ ] Create test strategy
- [ ] Prepare for store
- [ ] Create manual QA checklist
- [ ] Create release ADR (build targets, privacy, consent)

## Current Focus

**Next up:** State & Persistence - Implement multiple chat sessions and history
