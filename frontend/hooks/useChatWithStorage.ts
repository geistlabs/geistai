import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatAPI, ChatMessage } from '../lib/api/chat';
import { ApiClient, ApiConfig, ApiError } from '../lib/api/client';
import { useChatStorage, LegacyMessage } from './useChatStorage';

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
}

const defaultApiConfig: ApiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 30000,
  maxRetries: 3
};

export function useChatWithStorage(options: UseChatWithStorageOptions = {}): UseChatWithStorageReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const streamControllerRef = useRef<AbortController | null>(null);
  const tokenCountRef = useRef(0);
  const lastUserMessageRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false); // Keep a ref to avoid dependency issues in effects
  
  const apiClient = useRef(new ApiClient({ ...defaultApiConfig, ...options.apiConfig }));
  const chatApi = useRef(new ChatAPI(apiClient.current));

  // Storage integration
  const storage = useChatStorage(options.chatId);

  // Keep isStreamingRef in sync with isStreaming state
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Sync storage messages with local messages ONLY on chatId changes or initial load
  // Never during streaming to avoid conflicts
  useEffect(() => {
    if (storage.messages && !storage.isLoading && !storage.error && !isStreaming) {
      const chatMessages: ChatMessage[] = storage.messages
        .filter((msg: LegacyMessage) => msg && typeof msg === 'object' && msg.role && msg.text)
        .map((msg: LegacyMessage) => ({
          id: msg.id,
          role: msg.role,
          content: msg.text,
          timestamp: msg.timestamp
        }));
      
      console.log('[useChatWithStorage] Loading chat messages from storage:', chatMessages.length);
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
    timestamp: message.timestamp || Date.now()
  });

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
    
    // Update local state immediately
    console.log('[useChatWithStorage] Adding user message:', userMessage);
    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to storage asynchronously (don't block UI)
    if (options.chatId && storage.addMessage) {
      storage.addMessage(convertToLegacyMessage(userMessage)).catch(err => {
        console.error('[useChatWithStorage] Failed to save user message:', err);
      });
    }
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    
    try {
      console.log('[useChatWithStorage] Starting stream for message:', content);
      options.onStreamStart?.();
      
      // Set streaming state FIRST to prevent storage sync conflicts
      setIsStreaming(true);
      isStreamingRef.current = true;
      setIsLoading(false);
      
      console.log('[useChatWithStorage] Adding assistant message:', assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
      
      let accumulatedContent = '';
      tokenCountRef.current = 0;
      
      streamControllerRef.current = await chatApi.current.streamMessage(
        content,
        (token: string) => {
          console.log('[useChatWithStorage] Received token:', token);
          accumulatedContent += token;
          tokenCountRef.current++;
          
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return newMessages;
          });
          
          if (tokenCountRef.current % 10 === 0) {
            console.log('[useChatWithStorage] Token count:', tokenCountRef.current);
            options.onTokenCount?.(tokenCountRef.current);
          }
        },
        (error) => {
          console.error('[useChatWithStorage] Stream error:', error);
          setError(error);
          setIsStreaming(false);
          isStreamingRef.current = false;
          setIsLoading(false); // Ensure loading state is cleared on stream error
          options.onError?.(error);
        },
        () => {
          console.log('[useChatWithStorage] Stream completed. Total tokens:', tokenCountRef.current);
          setIsStreaming(false);
          isStreamingRef.current = false;
          setIsLoading(false); // Ensure loading state is cleared on completion
          options.onTokenCount?.(tokenCountRef.current);
          options.onStreamEnd?.();
          
          // Save final assistant message to storage asynchronously (don't block completion)
          if (options.chatId && storage.addMessage && accumulatedContent) {
            const finalAssistantMessage = {
              ...assistantMessage,
              content: accumulatedContent
            };
            storage.addMessage(convertToLegacyMessage(finalAssistantMessage)).catch(err => {
              console.error('[useChatWithStorage] Failed to save assistant message:', err);
            });
          }
        }
      );
    } catch (err) {
      console.error('[useChatWithStorage] Error sending message:', err);
      const error = err instanceof Error ? err : new Error('Failed to send message');
      setError(error);
      options.onError?.(error);
      
      // Remove empty assistant message if streaming failed
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
      setIsStreaming(false);
      isStreamingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isStreaming, options, storage.addMessage]);

  const stopStreaming = useCallback(() => {
    if (streamControllerRef.current) {
      console.log('[useChatWithStorage] Stopping stream');
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      setIsStreaming(false);
      isStreamingRef.current = false;
      setIsLoading(false); // Ensure loading state is cleared when interrupting
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
    // TODO: Sync this with storage if needed
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
    // TODO: Sync this with storage if needed
  }, []);

  const loadChat = useCallback((chatId: number) => {
    // This will be handled by the storage hook when chatId changes
    // But we can provide this function for external control
    if (storage.loadChat) {
      storage.loadChat(chatId);
    }
  }, [storage.loadChat]);

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
  };
}