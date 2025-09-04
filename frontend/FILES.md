# Files Structure - Geist v2 Frontend

## Core App Files
- `app/_layout.tsx` - Root layout with stack navigation
- `app/index.tsx` - Main chat screen component
- `app.json` - Expo configuration

## Components
- `components/chat/MessageBubble.tsx` - Chat message display component
- `components/chat/InputBar.tsx` - Message input with send button

## Configuration
- `package.json` - Dependencies (Expo, NativeWind, React Native)
- `tailwind.config.js` - Tailwind/NativeWind configuration
- `babel.config.js` - Babel configuration with NativeWind
- `tsconfig.json` - TypeScript configuration

## Styling
- `global.css` - Global Tailwind imports

## TODO: To Be Implemented
- `lib/api/client.ts` - HTTP client for backend
- `lib/api/chat.ts` - Chat API interface
- `hooks/useChat.ts` - Chat state management hook
- `hooks/useStreaming.ts` - SSE streaming hook
- `components/chat/InputBar.tsx` - Dedicated input component
- `components/chat/ChatList.tsx` - Optimized message list
- `components/chat/TypingIndicator.tsx` - Loading states