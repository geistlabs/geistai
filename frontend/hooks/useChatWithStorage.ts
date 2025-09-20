import { useCallback, useEffect, useRef, useState } from 'react';

import { ChatAPI, ChatMessage } from '../lib/api/chat';
import { ApiClient, ApiConfig } from '../lib/api/client';
import { ENV } from '../lib/config/environment';
import { TokenBatcher } from '../lib/streaming/tokenBatcher';

import { LegacyMessage, useChatStorage } from './useChatStorage';

export interface UseChatWithStorageOptions {
  chatId?: number;
  apiConfig?: Partial<ApiConfig>;
  onError?: (error: Error) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onTokenCount?: (count: number) => void;
}

export interface UseChatWithStorageReturn {
  // Chat functionality
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

  // Storage functionality
  currentChat: any;
  createNewChat: () => Promise<number>;
  loadChat: (chatId: number) => void;
  getAllChats: (options?: { includeArchived?: boolean }) => Promise<any[]>;
  deleteChat: (chatId: number) => Promise<void>;
  storageError: string | null;

  // API access
  chatApi: ChatAPI;
}

const defaultApiConfig: ApiConfig = {
  baseUrl: ENV.API_URL,
  timeout: 120000, // Increased to 2 minutes for long responses
  maxRetries: 3,
};

export function useChatWithStorage(
  options: UseChatWithStorageOptions = {},
): UseChatWithStorageReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const streamControllerRef = useRef<AbortController | null>(null);
  const tokenCountRef = useRef(0);
  const lastUserMessageRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false); // Keep a ref to avoid dependency issues in effects
  const currentChatIdRef = useRef<number | undefined>(options.chatId); // Track current chat ID

  const apiClient = useRef(
    new ApiClient({ ...defaultApiConfig, ...options.apiConfig }),
  );
  const chatApi = useRef(new ChatAPI(apiClient.current));

  // Storage integration
  const storage = useChatStorage(options.chatId);

  // Keep isStreamingRef in sync with isStreaming state
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Keep currentChatIdRef in sync with options.chatId
  useEffect(() => {
    currentChatIdRef.current = options.chatId;
  }, [options.chatId]);

  // Sync storage messages with local messages ONLY on chatId changes or initial load
  // Never during streaming to avoid conflicts
  useEffect(() => {
    if (
      storage.messages &&
      !storage.isLoading &&
      !storage.error &&
      !isStreaming
    ) {
      const chatMessages: ChatMessage[] = storage.messages
        .filter(
          (msg: LegacyMessage) =>
            msg && typeof msg === 'object' && msg.role && msg.text,
        )
        .map((msg: LegacyMessage) => ({
          id: msg.id,
          role: msg.role,
          content: msg.text,
          timestamp: msg.timestamp,
        }));

      setMessages(chatMessages);
    }
  }, [options.chatId, storage.isLoading]); // Only depend on chatId and loading state, not messages

  useEffect(() => {
    return () => {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
      }
      apiClient.current.cancelAll();
    };
  }, []);

  const convertToLegacyMessage = (message: ChatMessage): LegacyMessage => ({
    id: message.id || Date.now().toString(),
    text: message.content || '',
    role: message.role === 'system' ? 'assistant' : message.role,
    timestamp: message.timestamp || Date.now(),
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading || isStreaming) return;

      setError(null);
      setIsLoading(true);
      lastUserMessageRef.current = content;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Log input
      // Processing chat input
      const inputStartTime = Date.now();

      // Get current messages before updating state for passing to API
      const currentMessages = messages;

      // Update local state immediately
      setMessages(prev => [...prev, userMessage]);

      // Save user message to storage asynchronously (don't block UI)
      // Use the current chat ID from the ref, which is kept up to date
      const currentChatId = currentChatIdRef.current;
      if (currentChatId && storage.addMessage) {
        storage
          .addMessage(convertToLegacyMessage(userMessage), currentChatId)
          .catch(err => {
            console.error('[Chat] Failed to save user message:', err);
          });
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      try {
        options.onStreamStart?.();

        // Set streaming state FIRST to prevent storage sync conflicts
        setIsStreaming(true);
        isStreamingRef.current = true;
        setIsLoading(false);

        setMessages(prev => [...prev, assistantMessage]);

        let accumulatedContent = '';
        tokenCountRef.current = 0;

        let firstTokenLogged = false;

        // Create token batcher for optimized streaming
        const batcher = new TokenBatcher({
          batchSize: 10, // Batch 10 tokens before updating UI
          flushInterval: 100, // Or flush every 100ms
          onBatch: (batchedTokens: string) => {
            accumulatedContent += batchedTokens;

            // Log first token timing
            if (!firstTokenLogged) {
              const firstTokenTime = Date.now() - inputStartTime;
              // First token received
              firstTokenLogged = true;
            }

            // Update UI with batched tokens
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
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
          },
        });

        streamControllerRef.current = await chatApi.current.streamMessage(
          content,
          (token: string) => {
            // Add token to batcher instead of processing immediately
            batcher.addToken(token);
          },
          error => {
            console.error('[Chat] Stream error:', error);
            setError(error);
            setIsStreaming(false);
            isStreamingRef.current = false;
            setIsLoading(false); // Ensure loading state is cleared on stream error
            options.onError?.(error);
          },
          () => {
            // Complete the batcher to flush any remaining tokens
            batcher.complete();

            // Log output
            // Chat output completed

            setIsStreaming(false);
            isStreamingRef.current = false;
            setIsLoading(false); // Ensure loading state is cleared on completion
            options.onTokenCount?.(tokenCountRef.current);
            options.onStreamEnd?.();

            // Save final assistant message to storage asynchronously (don't block completion)
            const currentChatId = currentChatIdRef.current;
            if (currentChatId && storage.addMessage && accumulatedContent) {
              const finalAssistantMessage = {
                ...assistantMessage,
                content: accumulatedContent,
              };
              storage
                .addMessage(
                  convertToLegacyMessage(finalAssistantMessage),
                  currentChatId,
                )
                .catch(err => {
                  console.error(
                    '[Chat] Failed to save assistant message:',
                    err,
                  );
                });
            }
          },
          currentMessages, // Pass the conversation history (without the new user message)
        );
      } catch (err) {
        console.error('[Chat] Error sending message:', err);
        const error =
          err instanceof Error ? err : new Error('Failed to send message');
        setError(error);
        options.onError?.(error);

        // Remove empty assistant message if streaming failed
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
        setIsStreaming(false);
        isStreamingRef.current = false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, isStreaming, options, storage.addMessage],
  );

  const stopStreaming = useCallback(() => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      setIsStreaming(false);
      isStreamingRef.current = false;
      setIsLoading(false); // Ensure loading state is cleared when interrupting

      // Clean up the last assistant message if it's empty
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && !lastMessage.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });

      options.onStreamEnd?.();
    }
  }, [options]);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
    lastUserMessageRef.current = null;
    tokenCountRef.current = 0;
    // Note: We don't clear storage here - that would be deleteChat
  }, [stopStreaming]);

  const retryLastMessage = useCallback(async () => {
    if (lastUserMessageRef.current && !isLoading && !isStreaming) {
      const lastUserMessage = lastUserMessageRef.current;

      setMessages(prev => {
        const lastAssistantIndex = prev.findLastIndex(
          msg => msg.role === 'assistant',
        );
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
    // TODO: Sync this with storage if needed
  }, []);

  const editMessage = useCallback((index: number, content: string) => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages[index]) {
        newMessages[index] = {
          ...newMessages[index],
          content,
          timestamp: Date.now(),
        };
      }
      return newMessages;
    });
    // TODO: Sync this with storage if needed
  }, []);

  const loadChat = useCallback(
    (chatId: number) => {
      // This will be handled by the storage hook when chatId changes
      // But we can provide this function for external control
      if (storage.loadChat) {
        storage.loadChat(chatId);
      }
    },
    [storage.loadChat],
  );

  return {
    // Chat functionality
    messages,
    isLoading: isLoading || storage.isLoading, // Simplified - storage loading is now properly managed
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
    deleteMessage,
    editMessage,

    // Storage functionality
    currentChat: storage.currentChat,
    createNewChat: storage.createNewChat,
    loadChat,
    getAllChats: storage.getAllChats,
    deleteChat: storage.deleteChat,
    storageError: storage.error,

    // API access
    chatApi: chatApi.current,
  };
}
