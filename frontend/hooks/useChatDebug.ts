import { useCallback, useRef, useState } from 'react';

import { ChatAPIDebug, ChatMessage, DebugInfo } from '../lib/api/chat-debug';
import { ApiClient } from '../lib/api/client';

export interface UseChatDebugOptions {
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
  onDebugInfo?: (info: DebugInfo) => void;
  onTokenCount?: (count: number) => void;
  debugMode?: boolean;
}

export interface UseChatDebugReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  debugInfo: DebugInfo | null;
  chatApi: ChatAPIDebug;
}

export function useChatDebug(
  options: UseChatDebugOptions = {},
): UseChatDebugReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const streamControllerRef = useRef<AbortController | null>(null);
  const tokenCountRef = useRef(0);
  const inputStartTimeRef = useRef(0);

  // Initialize API client
  const apiClient = new ApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  });
  const chatApi = new ChatAPIDebug(apiClient);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading || isStreaming) {
        console.log('⚠️ [useChatDebug] Ignoring message - already processing');
        return;
      }

      if (!content || !content.trim()) {
        console.log('⚠️ [useChatDebug] Ignoring empty or undefined message');
        return;
      }

      console.log('🚀 [useChatDebug] Starting message send:', {
        content:
          content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        contentLength: content.length,
        messageCount: messages.length,
        timestamp: new Date().toISOString(),
      });

      inputStartTimeRef.current = Date.now();
      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      try {
        options.onStreamStart?.();

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsStreaming(true);
        setIsLoading(false);

        let accumulatedContent = '';
        tokenCountRef.current = 0;
        let firstTokenLogged = false;
        let debugInfoReceived = false;

        console.log('📡 [useChatDebug] Starting stream...');

        streamControllerRef.current = await chatApi.streamMessage(
          content,
          (token: string) => {
            // Log first token timing
            if (!firstTokenLogged) {
              const firstTokenTime = Date.now() - inputStartTimeRef.current;
              console.log('⚡ [useChatDebug] First token received:', {
                firstTokenTime: firstTokenTime + 'ms',
                token: token.substring(0, 20) + '...',
                accumulatedLength: accumulatedContent.length,
              });
              firstTokenLogged = true;
            }

            accumulatedContent += token;
            tokenCountRef.current++;

            // Update UI with new token
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.content = accumulatedContent;
              }
              return newMessages;
            });

            // Log progress every 50 tokens
            if (tokenCountRef.current % 50 === 0) {
              console.log('📊 [useChatDebug] Progress update:', {
                tokenCount: tokenCountRef.current,
                contentLength: accumulatedContent.length,
                estimatedTokensPerSecond:
                  tokenCountRef.current /
                  ((Date.now() - inputStartTimeRef.current) / 1000),
              });
            }

            options.onTokenCount?.(tokenCountRef.current);
          },
          (error: Error) => {
            console.error('❌ [useChatDebug] Stream error:', {
              error: error.message,
              tokenCount: tokenCountRef.current,
              contentLength: accumulatedContent.length,
              timestamp: new Date().toISOString(),
            });
            setError(error);
            setIsStreaming(false);
            options.onError?.(error);
          },
          () => {
            const totalTime = Date.now() - inputStartTimeRef.current;
            console.log('✅ [useChatDebug] Stream completed:', {
              totalTime: totalTime + 'ms',
              tokenCount: tokenCountRef.current,
              contentLength: accumulatedContent.length,
              averageTokensPerSecond:
                tokenCountRef.current / (totalTime / 1000),
              timestamp: new Date().toISOString(),
            });
            setIsStreaming(false);
            options.onStreamEnd?.();
          },
          messages,
          (info: DebugInfo) => {
            if (!debugInfoReceived) {
              console.log('🔍 [useChatDebug] Debug info received:', {
                connectionTime: info.connectionTime + 'ms',
                firstTokenTime: info.firstTokenTime + 'ms',
                totalTime: info.totalTime + 'ms',
                tokenCount: info.tokenCount,
                chunkCount: info.chunkCount,
                route: info.route,
                model: info.model,
                toolCalls: info.toolCalls,
                tokensPerSecond: info.tokensPerSecond,
                errors: info.errors.length,
              });

              setDebugInfo(info);
              options.onDebugInfo?.(info);
              debugInfoReceived = true;
            }
          },
        );

        // Final message update
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content = accumulatedContent;
          }
          return newMessages;
        });
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to send message');
        console.error('❌ [useChatDebug] Send message failed:', {
          error: error.message,
          content: content.substring(0, 100) + '...',
          timestamp: new Date().toISOString(),
        });
        setError(error);
        setIsLoading(false);
        setIsStreaming(false);
        options.onError?.(error);
      }
    },
    [isLoading, isStreaming, messages, chatApi, options],
  );

  const clearMessages = useCallback(() => {
    console.log('🗑️ [useChatDebug] Clearing messages');
    setMessages([]);
    setError(null);
    setDebugInfo(null);
    tokenCountRef.current = 0;

    // Cancel any ongoing stream
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    debugInfo,
    chatApi,
  };
}
