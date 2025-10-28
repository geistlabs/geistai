import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ChatAPI } from '../../lib/api/chat';
import { ApiClient } from '../../lib/api/client';
import { useChatStorage } from '../useChatStorage';
import { useMemoryManager } from '../useMemoryManager';

import { defaultConfig } from './config/chatConfig';
import { MemoryService } from './services/MemoryService';
import { StreamService } from './services/StreamService';
import { chatReducer, initialState } from './state/chatReducer';
import { ChatMessage, EnhancedMessage } from './types/ChatTypes';

export interface UseChatOptions {
  chatId?: number;
  isPremium?: boolean;
  onError?: (error: Error) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onTokenCount?: (count: number) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { isPremium = false } = options;

  // Refs
  const streamControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);
  const currentChatIdRef = useRef<number | undefined>(options.chatId);

  // API Client
  const apiClient = useRef(new ApiClient(defaultConfig.api));
  const chatApi = useRef(new ChatAPI(apiClient.current));

  // Services
  const storage = useChatStorage(options.chatId);
  const memoryManager = useMemoryManager({
    autoExtract: true,
    contextThreshold: defaultConfig.memory.contextThreshold,
    maxContextMemories: defaultConfig.memory.maxContextMemories,
  });

  // Initialize services
  const streamService = useRef(
    new StreamService({
      batchSize: defaultConfig.streaming.batchSize,
      flushInterval: defaultConfig.streaming.flushInterval,
      enhancedAssistantMessageId: '',
      dispatch,
    }),
  );

  const memoryService = useRef(
    new MemoryService({
      currentChatId: currentChatIdRef.current,
      memoryManager,
    }),
  );

  // Keep refs in sync with state
  useEffect(() => {
    isStreamingRef.current = state.isStreaming;
  }, [state.isStreaming]);

  useEffect(() => {
    currentChatIdRef.current = options.chatId;
    memoryService.current = new MemoryService({
      currentChatId: options.chatId,
      memoryManager,
    });
  }, [options.chatId, memoryManager]);

  // Cleanup on unmount
  useEffect(() => {
    const client = apiClient.current;
    return () => {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
      }
      client.cancelAll();
    };
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (state.isLoading || state.isStreaming) return;

      dispatch({ type: 'START_LOADING' });
      lastUserMessageRef.current = content;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Save user message
      if (currentChatIdRef.current && storage.addMessage) {
        await storage.addMessage(userMessage, currentChatIdRef.current);
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      try {
        options.onStreamStart?.();
        dispatch({ type: 'START_STREAMING' });

        // Add messages to state
        dispatch({ type: 'ADD_MESSAGE', message: userMessage });
        dispatch({ type: 'ADD_MESSAGE', message: assistantMessage });

        // Create enhanced messages
        const enhancedUserMessage: EnhancedMessage = {
          ...userMessage,
          isStreaming: false,
          agentConversations: [],
          toolCallEvents: [],
          collectedLinks: [],
        };

        const enhancedAssistantMessage: EnhancedMessage = {
          ...assistantMessage,
          isStreaming: true,
          agentConversations: [],
          toolCallEvents: [],
          collectedLinks: [],
        };

        dispatch({
          type: 'ADD_ENHANCED_MESSAGE',
          message: enhancedUserMessage,
        });
        dispatch({
          type: 'ADD_ENHANCED_MESSAGE',
          message: enhancedAssistantMessage,
        });

        // Update stream service with new message ID
        streamService.current = new StreamService({
          ...defaultConfig.streaming,
          enhancedAssistantMessageId: enhancedAssistantMessage.id,
          dispatch,
        });

        // Extract memories in parallel (non-blocking)
        memoryService.current
          .extractMemories(content, userMessage.id)
          .catch(error => {
            console.warn(
              '[Chat] Memory extraction failed (non-blocking):',
              error,
            );
          });

        // Get memory context
        const memoryContext =
          await memoryService.current.getRelevantContext(content);
        const messagesWithContext = [...state.messages];

        if (memoryContext) {
          messagesWithContext.unshift({
            id: 'memory-context',
            role: 'assistant', // Using assistant role for system messages
            content: memoryContext,
            timestamp: Date.now(),
          });
        }

        // Send message to appropriate endpoint
        if (isPremium) {
          await chatApi.current.sendStreamingMessage(
            content,
            messagesWithContext,
            streamService.current.createEventHandlers(),
          );
        } else {
          await chatApi.current.sendNegotiationMessage(
            content,
            messagesWithContext,
            streamService.current.createEventHandlers(),
          );
        }

        // Save assistant message
        if (currentChatIdRef.current && storage.addMessage) {
          const finalContent = streamService.current.getAccumulatedContent();
          await storage.addMessage(
            { ...assistantMessage, content: finalContent },
            currentChatIdRef.current,
          );
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to send message');
        dispatch({ type: 'SET_ERROR', error });
        options.onError?.(error);
      }
    },
    [
      state.isLoading,
      state.isStreaming,
      state.messages,
      options,
      storage,
      isPremium,
    ],
  );

  const stopStreaming = useCallback(() => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
      dispatch({ type: 'STOP_STREAMING' });
      options.onStreamEnd?.();
    }
  }, [options]);

  const clearMessages = useCallback(() => {
    stopStreaming();
    dispatch({ type: 'CLEAR_MESSAGES' });
    lastUserMessageRef.current = null;
  }, [stopStreaming]);

  return {
    // Chat state
    messages: state.messages,
    enhancedMessages: state.enhancedMessages,
    isLoading: state.isLoading || storage.isLoading,
    isStreaming: state.isStreaming,
    error: state.error,
    negotiationResult: state.negotiationResult,

    // Actions
    sendMessage,
    stopStreaming,
    clearMessages,

    // Storage integration
    currentChat: storage.currentChat,
    storageError: storage.error,
    createNewChat: storage.createNewChat, // Expose createNewChat from storage
    chatApi: chatApi.current, // Expose chatApi for audio transcription

    // Legacy data
    toolCallEvents: state.toolCallEvents,
    agentEvents: state.agentEvents,
    orchestratorStatus: state.orchestratorStatus,
  };
}
