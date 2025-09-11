import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatAPI, ChatMessage } from '../lib/api/chat';
import { ApiClient, ApiConfig, ApiError } from '../lib/api/client';
import { ENV } from '../lib/config/environment';
import { TokenBatcher } from '../lib/streaming/tokenBatcher';

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}

export interface UseChatOptions {
  apiConfig?: Partial<ApiConfig>;
  onError?: (error: Error) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onTokenCount?: (count: number) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  deleteMessage: (index: number) => void;
  editMessage: (index: number, content: string) => void;
}

const defaultApiConfig: ApiConfig = {
  baseUrl: ENV.API_URL,
  timeout: 120000, // Increased to 2 minutes for long responses
  maxRetries: 3
};

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const streamControllerRef = useRef<AbortController | null>(null);
  const tokenCountRef = useRef(0);
  const lastUserMessageRef = useRef<string | null>(null);
  
  const apiClient = useRef(new ApiClient({ ...defaultApiConfig, ...options.apiConfig }));
  const chatApi = useRef(new ChatAPI(apiClient.current));

  useEffect(() => {
    return () => {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
      }
      apiClient.current.cancelAll();
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading || isStreaming) return;
    
    setError(null);
    setIsLoading(true);
    lastUserMessageRef.current = content;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    // Get current messages before updating state for passing to API
    const currentMessages = messages;
    
    setMessages(prev => [...prev, userMessage]);
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    
    // Log input
    console.log('[Chat] Input:', content);
    const inputStartTime = Date.now();
    
    try {
      options.onStreamStart?.();
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsStreaming(true);
      setIsLoading(false);
      
      let accumulatedContent = '';
      tokenCountRef.current = 0;
      let firstTokenLogged = false;
      
      // Create token batcher for optimized streaming
      const batcher = new TokenBatcher({
        batchSize: 3, // Batch fewer tokens for faster first response
        flushInterval: 16, // Flush every 16ms (~60fps) for smoother rendering
        onBatch: (batchedTokens: string) => {
          accumulatedContent += batchedTokens;
          
          // Log first token timing
          if (!firstTokenLogged) {
            const firstTokenTime = Date.now() - inputStartTime;
            console.log('[Chat] First token time:', firstTokenTime + 'ms');
            firstTokenLogged = true;
          }
          
          // Update UI with batched tokens
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
          
          if (batcher.getTokenCount() % 100 === 0) {
            options.onTokenCount?.(batcher.getTokenCount());
          }
        },
        onComplete: () => {
          tokenCountRef.current = batcher.getTokenCount();
        }
      });
      
      streamControllerRef.current = await chatApi.current.streamMessage(
        content,
        (token: string) => {
          // Add token to batcher instead of processing immediately
          batcher.addToken(token);
        },
        (error) => {
          console.error('[Chat] Stream error:', error);
          setError(error);
          options.onError?.(error);
        },
        () => {
          // Complete the batcher to flush any remaining tokens
          batcher.complete();
          console.log('[Chat] Output:', accumulatedContent);
          setIsStreaming(false);
          options.onTokenCount?.(tokenCountRef.current);
          options.onStreamEnd?.();
        },
        currentMessages // Pass the conversation history (without the new user message)
      );
    } catch (err) {
      console.error('[Chat] Error sending message:', err);
      const error = err instanceof Error ? err : new Error('Failed to send message');
      setError(error);
      options.onError?.(error);
      
      // Remove empty assistant message if streaming failed
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
      // Note: Don't set isStreaming to false here as it's handled in callbacks
      // streamControllerRef.current = null; // Keep reference for abort functionality
    }
  }, [messages, isLoading, isStreaming, options]);

  const stopStreaming = useCallback(() => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      setIsStreaming(false);
      options.onStreamEnd?.();
    }
  }, [options]);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
    lastUserMessageRef.current = null;
    tokenCountRef.current = 0;
  }, [stopStreaming]);

  const retryLastMessage = useCallback(async () => {
    if (lastUserMessageRef.current && !isLoading && !isStreaming) {
      const lastUserMessage = lastUserMessageRef.current;
      
      setMessages(prev => {
        const lastAssistantIndex = prev.findLastIndex(msg => msg.role === 'assistant');
        if (lastAssistantIndex !== -1) {
          return prev.slice(0, lastAssistantIndex);
        }
        return prev;
      });
      
      await sendMessage(lastUserMessage);
    }
  }, [isLoading, isStreaming, sendMessage]);

  const deleteMessage = useCallback((index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const editMessage = useCallback((index: number, content: string) => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages[index]) {
        newMessages[index] = {
          ...newMessages[index],
          content,
          timestamp: Date.now()
        };
      }
      return newMessages;
    });
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
    deleteMessage,
    editMessage
  };
}