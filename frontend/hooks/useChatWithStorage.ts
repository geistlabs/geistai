import { useCallback, useEffect, useRef } from 'react';

import { AgentMessage, ChatMessage, NegotiationResult } from '../lib/api/chat';

import { useChat } from './chat';
import {
  AgentConversation,
  CollectedLink,
  EnhancedMessage,
  ToolCallEvent,
} from './chat/types/ChatTypes';
// Note: Storage functionality is now handled by the useChat hook

// Enhanced message interface matching backend webapp structure

// Utility function to collect and deduplicate links from enhanced messages
export function collectLinksFromEnhancedMessage(
  message: EnhancedMessage,
): CollectedLink[] {
  const links: CollectedLink[] = [];
  const seenUrls = new Set<string>();

  // Collect links from main message citations
  if (message.citations) {
    message.citations.forEach((citation, index) => {
      if (citation.url && !seenUrls.has(citation.url)) {
        seenUrls.add(citation.url);
        links.push({
          id: `citation-${message.id}-${index}`,
          url: citation.url,
          title: citation.source,
          source: citation.source,
          snippet: citation.snippet,
          agent: 'main',
          type: 'citation',
        });
      }
    });
  }

  // Collect links from agent conversations
  if (message.agentConversations) {
    message.agentConversations.forEach(conversation => {
      conversation.messages.forEach(agentMsg => {
        if (agentMsg.citations) {
          agentMsg.citations.forEach((citation, index) => {
            if (citation.url && !seenUrls.has(citation.url)) {
              seenUrls.add(citation.url);
              links.push({
                id: `agent-citation-${conversation.agent}-${agentMsg.id}-${index}`,
                url: citation.url,
                title: citation.source,
                source: citation.source,
                snippet: citation.snippet,
                agent: conversation.agent,
                type: 'citation',
              });
            }
          });
        }
      });
    });
  }

  return links;
}

// Main hook interface
export interface UseChatWithStorageOptions {
  chatId?: number;
  isPremium?: boolean;
  onError?: (error: Error) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onTokenCount?: (count: number) => void;
}

export function useChatWithStorage(options: UseChatWithStorageOptions = {}) {
  const { isPremium = false } = options;

  // Use the new modular chat hook
  const chat = useChat({
    chatId: options.chatId,
    isPremium,
    onError: options.onError,
    onStreamStart: options.onStreamStart,
    onStreamEnd: options.onStreamEnd,
    onTokenCount: options.onTokenCount,
  });

  // Legacy state is now handled by the chat hook

  // Refs for backward compatibility
  const lastUserMessageRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    isStreamingRef.current = chat.isStreaming;
  }, [chat.isStreaming]);

  // Create welcome message based on premium status
  const createWelcomeMessage = useCallback((): EnhancedMessage => {
    const welcomeContent = isPremium
      ? "Hello! I'm your AI assistant. How can I help you today?"
      : "Hello! I'm here to help you explore GeistAI Premium. What would you like to know about our features?";

    return {
      id: 'welcome',
      role: 'assistant',
      content: welcomeContent,
      timestamp: Date.now(),
      isStreaming: false,
      agentConversations: [],
      toolCallEvents: [],
      collectedLinks: [],
    };
  }, [isPremium]);

  // Initialize with welcome message if no messages exist
  const messagesWithWelcome =
    chat.enhancedMessages.length === 0
      ? [createWelcomeMessage()]
      : chat.enhancedMessages;

  // Collect all links from enhanced messages
  const collectedLinks = messagesWithWelcome.flatMap(
    collectLinksFromEnhancedMessage,
  );

  // Legacy sendMessage wrapper
  const sendMessage = useCallback(
    async (content: string) => {
      lastUserMessageRef.current = content;
      return chat.sendMessage(content);
    },
    [chat],
  );

  // Legacy retryLastMessage wrapper
  const retryLastMessage = useCallback(async () => {
    if (lastUserMessageRef.current) {
      return sendMessage(lastUserMessageRef.current);
    }
  }, [sendMessage]);

  // Legacy clearMessages wrapper
  const clearMessages = useCallback(() => {
    chat.clearMessages();
    lastUserMessageRef.current = null;
  }, [chat]);

  // Legacy stopStreaming wrapper
  const stopStreaming = useCallback(() => {
    chat.stopStreaming();
  }, [chat]);

  // Update welcome message when premium status changes
  useEffect(() => {
    if (chat.enhancedMessages.length === 0) {
      // This will trigger a re-render with the new welcome message
      // due to the messagesWithWelcome calculation above
    }
  }, [isPremium, chat.enhancedMessages.length]);

  return {
    // Core chat functionality from new modular system
    messages: chat.messages,
    enhancedMessages: messagesWithWelcome,
    isLoading: chat.isLoading,
    isStreaming: chat.isStreaming,
    error: chat.error,
    negotiationResult: chat.negotiationResult,

    // Actions
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,

    // Storage integration
    currentChat: chat.currentChat,
    storageError: chat.storageError,
    createNewChat: chat.createNewChat, // Expose createNewChat from useChat
    chatApi: chat.chatApi, // Expose chatApi for audio transcription

    // Collected data
    collectedLinks,

    // Legacy compatibility (maintained for existing components)
    toolCallEvents: chat.toolCallEvents,
    agentEvents: chat.agentEvents,
    orchestratorStatus: chat.orchestratorStatus,

    // Legacy refs (for components that might access them)
    lastUserMessage: lastUserMessageRef.current,
    isStreamingRef,
  };
}

// Export types for backward compatibility
export type {
  AgentConversation,
  AgentMessage,
  ChatMessage,
  CollectedLink,
  EnhancedMessage,
  NegotiationResult,
  ToolCallEvent,
};
