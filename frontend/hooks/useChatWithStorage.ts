import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AgentMessage,
  sendNegotiationMessage as apiSendNegotiationMessage,
  ChatAPI,
  ChatMessage,
  NegotiationResult,
  sendStreamingMessage,
  StreamEventHandlers,
} from '../lib/api/chat';
import { ApiClient, ApiConfig } from '../lib/api/client';
import { ENV } from '../lib/config/environment';
import { Memory, memoryService } from '../lib/memoryService';
import { TokenBatcher } from '../lib/streaming/tokenBatcher';

import {
  ChatMessage as StorageChatMessage,
  useChatStorage,
} from './useChatStorage';
import { useMemoryManager } from './useMemoryManager';

// Enhanced message interface matching backend webapp structure
export interface EnhancedMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isStreaming?: boolean;
  citations?: any[];
  agentConversations?: AgentConversation[];
  collectedLinks?: CollectedLink[];
  toolCallEvents?: ToolCallEvent[];
}

export interface CollectedLink {
  id: string;
  url: string;
  title?: string;
  source?: string;
  snippet?: string;
  agent?: string;
  type: 'citation' | 'link';
}

export interface ToolCallEvent {
  id: string;
  type: 'start' | 'complete' | 'error';
  toolName: string;
  arguments?: any;
  result?: any;
  error?: string;
  timestamp: Date;
  status: 'active' | 'completed' | 'error';
}

export interface AgentConversation {
  agent: string;
  messages: EnhancedMessage[];
  timestamp: Date;
  type: 'start' | 'token' | 'complete' | 'error';
  status?: string;
  task?: string;
  context?: string;
}

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
    message.agentConversations.forEach(agentConvo => {
      if (agentConvo.messages) {
        agentConvo.messages.forEach(agentMsg => {
          // Parse citations from agent message content
          if (agentMsg.content) {
            // Simple citation parsing - you might want to use a more sophisticated parser
            const citationRegex = /<citation[^>]*url="([^"]*)"[^>]*>/g;
            let match;
            while ((match = citationRegex.exec(agentMsg.content)) !== null) {
              const url = match[1];
              if (url && !seenUrls.has(url)) {
                seenUrls.add(url);
                links.push({
                  id: `agent-${agentConvo.agent}-${links.length}`,
                  url: url,
                  title: `Link from ${agentConvo.agent}`,
                  source: agentConvo.agent,
                  agent: agentConvo.agent,
                  type: 'citation',
                });
              }
            }
          }
        });
      }
    });
  }

  return links;
}

export interface UseChatWithStorageOptions {
  chatId?: number;
  apiConfig?: Partial<ApiConfig>;
  isPremium?: boolean;
  onError?: (error: Error) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onTokenCount?: (count: number) => void;
}

export interface UseChatWithStorageReturn {
  // Chat functionality
  messages: ChatMessage[];
  enhancedMessages: EnhancedMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  sendNegotiationMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  deleteMessage: (index: number) => void;
  editMessage: (index: number, content: string) => void;

  // Rich event data (legacy - kept for backward compatibility)
  toolCallEvents: any[];
  agentEvents: AgentMessage[];
  orchestratorStatus: {
    isActive: boolean;
    currentAgent?: string;
    status?: string;
  };
  negotiationResult: NegotiationResult | null;

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
  const { isPremium = false } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [enhancedMessages, setEnhancedMessages] = useState<EnhancedMessage[]>([
    {
      id: '1',
      content: isPremium
        ? 'Hello! This is a basic chat interface for testing the GeistAI router with enhanced message features. Type a message to get started and see rich agent activity, tool calls, and citations.'
        : "Hello! I'm here to help you find the perfect GeistAI subscription plan for your needs. Let's start by understanding what you're looking to accomplish with GeistAI.",
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: false,
      agentConversations: [],
      toolCallEvents: [],
      collectedLinks: [],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Rich event state (legacy - kept for backward compatibility)
  const [toolCallEvents, setToolCallEvents] = useState<any[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentMessage[]>([]);
  const [orchestratorStatus, setOrchestratorStatus] = useState<{
    isActive: boolean;
    currentAgent?: string;
    status?: string;
  }>({ isActive: false });

  // Negotiation result state
  const [negotiationResult, setNegotiationResult] =
    useState<NegotiationResult | null>(null);

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

  // Memory integration
  const memoryManager = useMemoryManager({
    autoExtract: true,
    contextThreshold: 0.7,
    maxContextMemories: 5,
  });

  // Keep isStreamingRef in sync with isStreaming state
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Keep currentChatIdRef in sync with options.chatId
  useEffect(() => {
    currentChatIdRef.current = options.chatId;
  }, [options.chatId]);

  // Update welcome message and clear negotiation result when isPremium changes
  useEffect(() => {
    console.log(`🔄 [Chat] isPremium changed to: ${isPremium}`);

    // If user just became premium, clear the negotiation result so upgrade button disappears
    if (isPremium) {
      setNegotiationResult(null);
      console.log('✅ [Chat] User became premium - cleared negotiation result');
    }

    // Update the welcome message based on premium status
    const welcomeMessage = isPremium
      ? 'Hello! This is a basic chat interface for testing the GeistAI router with enhanced message features. Type a message to get started and see rich agent activity, tool calls, and citations.'
      : "Hello! I'm here to help you find the perfect GeistAI subscription plan for your needs. Let's start by understanding what you're looking to accomplish with GeistAI.";

    console.log(
      `🔄 [Chat] Updating welcome message: ${welcomeMessage.substring(0, 50)}...`,
    );

    setEnhancedMessages(prev => {
      // Only update the welcome message if it exists (id === '1')
      if (prev.length > 0 && prev[0].id === '1') {
        return [
          {
            ...prev[0],
            content: welcomeMessage,
          },
          ...prev.slice(1),
        ];
      }
      return prev;
    });
  }, [isPremium]);

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
          (msg: StorageChatMessage) =>
            msg && typeof msg === 'object' && msg.role && msg.content,
        )
        .map((msg: StorageChatMessage) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
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

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading || isStreaming) return;

      setError(null);
      setIsLoading(true);
      lastUserMessageRef.current = content;

      // Clear rich event data for new message
      setToolCallEvents([]);
      setAgentEvents([]);
      setOrchestratorStatus({ isActive: false });

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

      // Get current chat ID from ref
      const currentChatId = currentChatIdRef.current;
      console.log(`🔍 [Chat] Current chat ID: ${currentChatId}`);

      // Update local state immediately - show user message right away
      setMessages(prev => [...prev, userMessage]);

      // 1. IMMEDIATELY extract memories from the question using /api/memory
      console.log(
        '🧠 [Chat] STEP 1: Extracting memories from user question...',
      );
      const memoryExtractionPromise =
        memoryService.extractMemoriesFromQuestion(content);

      // Save user message to storage asynchronously (don't block streaming)
      if (currentChatId && storage.addMessage) {
        storage
          .addMessage(userMessage, currentChatId)
          .then(() => console.log('🧠 [Chat] ✅ User message saved to storage'))
          .catch(err =>
            console.error('[Chat] Failed to save user message:', err),
          );
      }

      // Store assistant message saving function for later sequential execution
      const saveAssistantMessageAsync = async (
        assistantMessage: ChatMessage,
      ) => {
        try {
          if (currentChatId && storage.addMessage) {
            await storage.addMessage(assistantMessage, currentChatId);
            console.log('🧠 [Chat] ✅ Assistant message saved to storage');
          }
        } catch (err) {
          console.error('[Chat] Failed to save assistant message:', err);
        }
      };

      // 3. When /api/memory returns, store the memories asynchronously
      memoryExtractionPromise
        .then(async extractedMemories => {
          try {
            if (extractedMemories.length > 0) {
              console.log(
                '🧠 [Chat] STEP 3: ✅ Extracted memories from /api/memory:',
                extractedMemories,
              );

              // Convert extracted memories to full Memory objects and store them
              if (memoryManager.isInitialized && currentChatId) {
                const memories: Memory[] = [];

                for (const memoryData of extractedMemories) {
                  const embedding = await memoryService.getEmbedding(
                    memoryData.content,
                  );

                  if (embedding.length > 0) {
                    const memory: Memory = {
                      id: `${currentChatId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      chatId: currentChatId,
                      content: memoryData.content,
                      originalContext: memoryData.originalContext || content,
                      embedding,
                      relevanceScore: memoryData.relevanceScore || 0.8,
                      extractedAt: Date.now(),
                      messageIds: [parseInt(userMessage.id || '0')],
                      category: memoryData.category || 'other',
                    };

                    memories.push(memory);
                  }
                }

                if (memories.length > 0) {
                  console.log(
                    '🧠 [Chat] Storing extracted memories:',
                    memories.length,
                  );
                  await memoryManager.storeMemories(memories);
                  console.log('🧠 [Chat] ✅ Memories stored successfully');
                }
              }
            } else {
              console.log('🧠 [Chat] No memories extracted from question');
            }
          } catch (err) {
            console.warn('🧠 [Chat] Failed to store memories:', err);
          }
        })
        .catch(err => {
          console.error('🧠 [Chat] Memory extraction failed:', err);
        });

      // Get relevant memory context asynchronously (don't block streaming)
      const memoryContext = '';
      const getMemoryContextAsync = async () => {
        if (memoryManager.isInitialized && currentChatId) {
          try {
            return await memoryManager.getRelevantContext(
              content,
              currentChatId,
            );
          } catch (err) {
            console.warn('Failed to get memory context:', err);
            return '';
          }
        }
        return '';
      };

      // Start memory context retrieval but don't wait for it
      const memoryContextPromise = getMemoryContextAsync();

      // Save user message to storage asynchronously (don't block UI)
      // Use the current chat ID from the ref, which is kept up to date
      if (currentChatId && storage.addMessage) {
        storage.addMessage(userMessage, currentChatId).catch(err => {
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

        // Create enhanced user message
        const enhancedUserMessage: EnhancedMessage = {
          id: Date.now().toString(),
          content: content,
          role: 'user',
          timestamp: new Date(),
          isStreaming: false,
          agentConversations: [],
          toolCallEvents: [],
          collectedLinks: [],
        };

        // Create enhanced assistant message for rich event tracking
        const enhancedAssistantMessageId = (Date.now() + 1).toString();
        const enhancedAssistantMessage: EnhancedMessage = {
          id: enhancedAssistantMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          isStreaming: true,
          agentConversations: [],
          toolCallEvents: [],
          collectedLinks: [],
        };

        setEnhancedMessages(prev => [
          ...prev,
          enhancedUserMessage,
          enhancedAssistantMessage,
        ]);

        // Create event handlers object
        const eventHandlers: StreamEventHandlers = {
          onToken: (token: string) => {
            // Add token to batcher instead of processing immediately
            batcher.addToken(token);
            // Update enhanced message content
            setEnhancedMessages(prev =>
              prev.map(msg =>
                msg.id === enhancedAssistantMessageId
                  ? { ...msg, content: msg.content + token }
                  : msg,
              ),
            );
          },
          onSubAgentEvent: agentEvent => {
            // Handle sub-agent events in enhanced messages
            setEnhancedMessages(prev =>
              prev.map(msg => {
                if (msg.id === enhancedAssistantMessageId) {
                  const agentConvos = msg.agentConversations || [];
                  const existingIdx = agentConvos.findIndex(
                    convo => convo.agent === agentEvent.agent,
                  );

                  let updatedAgentConvos;
                  if (existingIdx !== -1) {
                    // Update existing agent conversation
                    updatedAgentConvos = agentConvos.map((convo, idx) =>
                      idx === existingIdx
                        ? {
                            ...convo,
                            messages:
                              convo.messages.length > 0
                                ? [
                                    {
                                      ...convo.messages[0],
                                      content:
                                        convo.messages[0].content +
                                        agentEvent.token,
                                      isStreaming: agentEvent.isStreaming,
                                    },
                                    ...convo.messages.slice(1),
                                  ]
                                : [
                                    {
                                      id: agentEvent.token,
                                      content: agentEvent.token,
                                      role: 'assistant' as const,
                                      timestamp: new Date(),
                                      isStreaming: agentEvent.isStreaming,
                                    },
                                  ],
                          }
                        : convo,
                    );
                  } else {
                    // Create new agent conversation
                    const newAgentConvo: AgentConversation = {
                      timestamp: new Date(),
                      type: agentEvent.isStreaming ? 'start' : 'complete',
                      agent: agentEvent.agent,
                      task: agentEvent.task,
                      context: agentEvent.context,
                      messages: [
                        {
                          id: agentEvent.token,
                          content: agentEvent.token,
                          role: 'assistant' as const,
                          timestamp: new Date(),
                          isStreaming: agentEvent.isStreaming,
                        },
                      ],
                    };
                    updatedAgentConvos = [...agentConvos, newAgentConvo];
                  }

                  return { ...msg, agentConversations: updatedAgentConvos };
                }
                return msg;
              }),
            );

            // Legacy event handling for backward compatibility
            const agentMessage: AgentMessage = {
              agent: agentEvent.agent,
              content: agentEvent.token,
              timestamp: Date.now(),
              type: agentEvent.isStreaming ? 'start' : 'complete',
              status: agentEvent.isStreaming ? 'active' : 'completed',
            };
            setAgentEvents(prev => [...prev, agentMessage]);

            // Update orchestrator status based on sub-agent events
            if (agentEvent.isStreaming) {
              setOrchestratorStatus(prev => ({
                ...prev,
                currentAgent: agentEvent.agent,
                status: 'agent_active',
              }));
            } else {
              setOrchestratorStatus(prev => ({
                ...prev,
                status: 'agent_completed',
              }));
            }
          },
          onToolCallEvent: toolCallEvent => {
            // Handle tool call events in enhanced messages
            setEnhancedMessages(prev =>
              prev.map(msg => {
                if (msg.id === enhancedAssistantMessageId) {
                  const toolCallEvents = msg.toolCallEvents || [];
                  const eventId = `${toolCallEvent.toolName}-${Date.now()}-${Math.random()}`;

                  if (toolCallEvent.type === 'start') {
                    // Add new tool call event
                    const newEvent: ToolCallEvent = {
                      id: eventId,
                      type: 'start',
                      toolName: toolCallEvent.toolName,
                      arguments: toolCallEvent.arguments,
                      timestamp: new Date(),
                      status: 'active',
                    };
                    return {
                      ...msg,
                      toolCallEvents: [...toolCallEvents, newEvent],
                    };
                  } else if (
                    toolCallEvent.type === 'complete' ||
                    toolCallEvent.type === 'error'
                  ) {
                    // Update existing tool call event
                    const updatedEvents: ToolCallEvent[] = toolCallEvents.map(
                      event => {
                        if (
                          event.toolName === toolCallEvent.toolName &&
                          event.status === 'active'
                        ) {
                          return {
                            ...event,
                            type: toolCallEvent.type as 'complete' | 'error',
                            result: toolCallEvent.result,
                            error: toolCallEvent.error,
                            status: (toolCallEvent.type === 'complete'
                              ? 'completed'
                              : 'error') as 'completed' | 'error',
                          };
                        }
                        return event;
                      },
                    );
                    return { ...msg, toolCallEvents: updatedEvents };
                  }
                }
                return msg;
              }),
            );

            // Legacy event handling for backward compatibility
            setToolCallEvents(prev => [...prev, toolCallEvent]);
          },
          onComplete: () => {
            // Complete the batcher to flush any remaining tokens
            batcher.complete();

            // Mark enhanced message as complete and collect links
            setEnhancedMessages(prev =>
              prev.map(msg => {
                if (msg.id === enhancedAssistantMessageId) {
                  // Collect links from the completed message
                  const collectedLinks = collectLinksFromEnhancedMessage(msg);

                  return {
                    ...msg,
                    isStreaming: false,
                    collectedLinks: collectedLinks,
                  };
                }
                return msg;
              }),
            );

            setIsStreaming(false);
            isStreamingRef.current = false;
            setIsLoading(false); // Ensure loading state is cleared on completion
            options.onTokenCount?.(tokenCountRef.current);
            options.onStreamEnd?.();

            // Save final assistant message to storage asynchronously (don't block completion)
            if (currentChatId && accumulatedContent) {
              const finalAssistantMessage = {
                ...assistantMessage,
                content: accumulatedContent,
              };
              // Save assistant message sequentially to avoid transaction conflicts
              saveAssistantMessageAsync(finalAssistantMessage);

              // Memory extraction is now handled in real-time during user input
              // No need for post-conversation extraction since we extract from each question immediately
              console.log(
                '[Memory] 🧠 Memory extraction handled during user input - no post-processing needed',
              );
            }
          },
          onError: (error: string) => {
            console.error('[Chat] Stream error:', error);
            const errorObj = new Error(error);
            setError(errorObj);
            setIsStreaming(false);
            isStreamingRef.current = false;
            setIsLoading(false); // Ensure loading state is cleared on stream error
            options.onError?.(errorObj);
          },
          onNegotiationChannel: (data: {
            final_price: number;
            package_id: string;
            negotiation_summary: string;
            stage: string;
            confidence: number;
          }) => {
            console.log(
              '🎯 [Hook] onNegotiationChannel handler called with:',
              data,
            );

            // Convert channel data to NegotiationResult format for state update
            const negotiationResult: NegotiationResult = {
              final_price: data.final_price,
              package_id: data.package_id,
              negotiation_summary: data.negotiation_summary,
            };

            console.log(
              '🔄 [Hook] Updating negotiationResult state:',
              negotiationResult,
            );
            setNegotiationResult(negotiationResult);
          },
        };

        // Prepare messages with memory context
        const messagesWithContext = [...currentMessages];

        // Wait for memory context to be retrieved (if it finishes quickly)
        // But don't wait more than 500ms to avoid blocking streaming
        try {
          const contextWithTimeout = await Promise.race([
            memoryContextPromise,
            new Promise<string>(resolve => setTimeout(() => resolve(''), 500)),
          ]);

          if (contextWithTimeout) {
            // Insert memory context as a system message at the beginning
            messagesWithContext.unshift({
              id: 'memory-context',
              role: 'system',
              content: contextWithTimeout,
              timestamp: Date.now(),
            });
            console.log('🧠 [Chat] ✅ Added memory context to request');
            console.log(
              '🧠 [Chat] Memory context content:',
              contextWithTimeout,
            );
          } else {
            console.log(
              '🧠 [Chat] ⚠️ No memory context retrieved (empty or timeout)',
            );
          }
        } catch (err) {
          console.warn(
            '🧠 [Chat] ❌ Memory context retrieval timed out or failed:',
            err,
          );
        }

        // 2. Start streaming to appropriate endpoint based on premium status
        const endpoint = isPremium ? '/api/stream' : '/api/negotiate';
        console.log(`🧠 [Chat] STEP 2: Starting streaming to ${endpoint}...`);

        if (isPremium) {
          await sendStreamingMessage(
            content,
            messagesWithContext,
            eventHandlers,
          );
        } else {
          await apiSendNegotiationMessage(
            content,
            messagesWithContext,
            eventHandlers,
          );
        }
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

  const sendNegotiationMessage = useCallback(
    async (content: string) => {
      if (isLoading || isStreaming) return;

      setError(null);
      setIsLoading(true);
      lastUserMessageRef.current = content;

      // Clear rich event data for new message
      setToolCallEvents([]);
      setAgentEvents([]);
      setOrchestratorStatus({ isActive: false });

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Get current messages before updating state for passing to API
      const currentMessages = messages;

      // Get current chat ID from ref
      const currentChatId = currentChatIdRef.current;

      // Update local state immediately - show user message right away
      setMessages(prev => [...prev, userMessage]);

      // Save user message to storage asynchronously (don't block streaming)
      if (currentChatId && storage.addMessage) {
        storage
          .addMessage(userMessage, currentChatId)
          .then(() =>
            console.log('🧠 [Negotiate] ✅ User message saved to storage'),
          )
          .catch(err =>
            console.error('[Negotiate] Failed to save user message:', err),
          );
      }

      // Store assistant message saving function for later sequential execution
      const saveAssistantMessageAsync = async (
        assistantMessage: ChatMessage,
      ) => {
        try {
          if (currentChatId && storage.addMessage) {
            await storage.addMessage(assistantMessage, currentChatId);
            console.log('🧠 [Negotiate] ✅ Assistant message saved to storage');
          }
        } catch (err) {
          console.error('[Negotiate] Failed to save assistant message:', err);
        }
      };

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

        // Create token batcher for optimized streaming
        const batcher = new TokenBatcher({
          batchSize: 10, // Batch 10 tokens before updating UI
          flushInterval: 100, // Or flush every 100ms
          onBatch: (batchedTokens: string) => {
            // Update UI with batched tokens (don't accumulate here - done in onToken)
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content += batchedTokens;
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

        // Create enhanced user message
        const enhancedUserMessage: EnhancedMessage = {
          id: Date.now().toString(),
          content: content,
          role: 'user',
          timestamp: new Date(),
          isStreaming: false,
          agentConversations: [],
          toolCallEvents: [],
          collectedLinks: [],
        };

        // Create enhanced assistant message for rich event tracking
        const enhancedAssistantMessageId = (Date.now() + 1).toString();
        const enhancedAssistantMessage: EnhancedMessage = {
          id: enhancedAssistantMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          isStreaming: true,
          agentConversations: [],
          toolCallEvents: [],
          collectedLinks: [],
        };

        setEnhancedMessages(prev => [
          ...prev,
          enhancedUserMessage,
          enhancedAssistantMessage,
        ]);

        // Create event handlers object
        const eventHandlers: StreamEventHandlers = {
          onToken: (token: string) => {
            // Add token to batcher instead of processing immediately
            batcher.addToken(token);

            // Update enhanced message content
            setEnhancedMessages(prev =>
              prev.map(msg =>
                msg.id === enhancedAssistantMessageId
                  ? { ...msg, content: msg.content + token }
                  : msg,
              ),
            );

            // Accumulate content for later parsing
            accumulatedContent += token;
          },
          onSubAgentEvent: agentEvent => {
            // Handle sub-agent events in enhanced messages
            setEnhancedMessages(prev =>
              prev.map(msg => {
                if (msg.id === enhancedAssistantMessageId) {
                  const agentConvos = msg.agentConversations || [];
                  const existingIdx = agentConvos.findIndex(
                    convo => convo.agent === agentEvent.agent,
                  );

                  let updatedAgentConvos;
                  if (existingIdx !== -1) {
                    // Update existing agent conversation
                    updatedAgentConvos = agentConvos.map((convo, idx) =>
                      idx === existingIdx
                        ? {
                            ...convo,
                            messages:
                              convo.messages.length > 0
                                ? [
                                    {
                                      ...convo.messages[0],
                                      content:
                                        convo.messages[0].content +
                                        agentEvent.token,
                                      isStreaming: agentEvent.isStreaming,
                                    },
                                    ...convo.messages.slice(1),
                                  ]
                                : [
                                    {
                                      id: agentEvent.token,
                                      content: agentEvent.token,
                                      role: 'assistant' as const,
                                      timestamp: new Date(),
                                      isStreaming: agentEvent.isStreaming,
                                    },
                                  ],
                          }
                        : convo,
                    );
                  } else {
                    // Create new agent conversation
                    const newAgentConvo: AgentConversation = {
                      timestamp: new Date(),
                      type: agentEvent.isStreaming ? 'start' : 'complete',
                      agent: agentEvent.agent,
                      task: agentEvent.task,
                      context: agentEvent.context,
                      messages: [
                        {
                          id: agentEvent.token,
                          content: agentEvent.token,
                          role: 'assistant' as const,
                          timestamp: new Date(),
                          isStreaming: agentEvent.isStreaming,
                        },
                      ],
                    };
                    updatedAgentConvos = [...agentConvos, newAgentConvo];
                  }

                  return { ...msg, agentConversations: updatedAgentConvos };
                }
                return msg;
              }),
            );

            // Legacy event handling for backward compatibility
            const agentMessage: AgentMessage = {
              agent: agentEvent.agent,
              content: agentEvent.token,
              timestamp: Date.now(),
              type: agentEvent.isStreaming ? 'start' : 'complete',
              status: agentEvent.isStreaming ? 'active' : 'completed',
            };
            setAgentEvents(prev => [...prev, agentMessage]);

            // Update orchestrator status based on sub-agent events
            if (agentEvent.isStreaming) {
              setOrchestratorStatus(prev => ({
                ...prev,
                currentAgent: agentEvent.agent,
                status: 'agent_active',
              }));
            } else {
              setOrchestratorStatus(prev => ({
                ...prev,
                status: 'agent_completed',
              }));
            }
          },
          onToolCallEvent: toolCallEvent => {
            // Handle tool call events in enhanced messages
            setEnhancedMessages(prev =>
              prev.map(msg => {
                if (msg.id === enhancedAssistantMessageId) {
                  const toolCallEvents = msg.toolCallEvents || [];
                  const eventId = `${toolCallEvent.toolName}-${Date.now()}-${Math.random()}`;

                  if (toolCallEvent.type === 'start') {
                    // Add new tool call event
                    const newEvent: ToolCallEvent = {
                      id: eventId,
                      type: 'start',
                      toolName: toolCallEvent.toolName,
                      arguments: toolCallEvent.arguments,
                      timestamp: new Date(),
                      status: 'active',
                    };
                    return {
                      ...msg,
                      toolCallEvents: [...toolCallEvents, newEvent],
                    };
                  } else if (
                    toolCallEvent.type === 'complete' ||
                    toolCallEvent.type === 'error'
                  ) {
                    // Update existing tool call event
                    const updatedEvents: ToolCallEvent[] = toolCallEvents.map(
                      event => {
                        if (
                          event.toolName === toolCallEvent.toolName &&
                          event.status === 'active'
                        ) {
                          return {
                            ...event,
                            type: toolCallEvent.type as 'complete' | 'error',
                            result: toolCallEvent.result,
                            error: toolCallEvent.error,
                            status: (toolCallEvent.type === 'complete'
                              ? 'completed'
                              : 'error') as 'completed' | 'error',
                          };
                        }
                        return event;
                      },
                    );
                    return { ...msg, toolCallEvents: updatedEvents };
                  }
                }
                return msg;
              }),
            );

            // Legacy event handling for backward compatibility
            setToolCallEvents(prev => [...prev, toolCallEvent]);
          },
          onComplete: () => {
            // Mark enhanced message as complete and collect links
            setEnhancedMessages(prev =>
              prev.map(msg => {
                if (msg.id === enhancedAssistantMessageId) {
                  // Collect links from the completed message
                  const collectedLinks = collectLinksFromEnhancedMessage(msg);

                  return {
                    ...msg,
                    isStreaming: false,
                    collectedLinks: collectedLinks,
                  };
                }
                return msg;
              }),
            );

            setIsStreaming(false);
            isStreamingRef.current = false;
            setIsLoading(false);

            // Save final assistant message to storage asynchronously (don't block completion)
            if (currentChatId && storage.addMessage && accumulatedContent) {
              const finalAssistantMessage = {
                ...assistantMessage,
                content: accumulatedContent,
              };
              // Save assistant message sequentially to avoid transaction conflicts
              saveAssistantMessageAsync(finalAssistantMessage);
            }

            options.onStreamEnd?.();
          },
          onError: (error: string) => {
            console.error('[Negotiate] Stream error:', error);
            setError(new Error(error));
            setIsStreaming(false);
            isStreamingRef.current = false;
            setIsLoading(false);
            options.onStreamEnd?.();
          },
          onNegotiationResult: (result: NegotiationResult) => {
            console.log('💰 [Negotiate] Negotiation result received:', result);
            console.log(
              '🔍 [DEBUG] Setting negotiationResult state to:',
              result,
            );
            setNegotiationResult(result);
          },
          onNegotiationChannel: (data: {
            final_price: number;
            package_id: string;
            negotiation_summary: string;
            stage: string;
            confidence: number;
          }) => {
            console.log(
              '🎯 [Hook] onNegotiationChannel handler called with:',
              data,
            );

            // Convert channel data to NegotiationResult format for state update
            const negotiationResult: NegotiationResult = {
              final_price: data.final_price,
              package_id: data.package_id,
              negotiation_summary: data.negotiation_summary,
            };

            console.log(
              '🔄 [Hook] Updating negotiationResult state:',
              negotiationResult,
            );
            setNegotiationResult(negotiationResult);
          },
        };

        // Debug: Log the eventHandlers before sending
        console.log('🔍 [Hook] About to send negotiation with handlers:', {
          onToken: !!eventHandlers.onToken,
          onComplete: !!eventHandlers.onComplete,
          onError: !!eventHandlers.onError,
          onNegotiationChannel: !!eventHandlers.onNegotiationChannel,
          onNegotiationResult: !!eventHandlers.onNegotiationResult,
        });

        // Use the negotiation endpoint
        await apiSendNegotiationMessage(
          content,
          currentMessages,
          eventHandlers,
        );
      } catch (err) {
        console.error('[Negotiate] Error sending message:', err);
        setError(
          err instanceof Error ? err : new Error('Failed to send message'),
        );

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
    setEnhancedMessages([]);
    setError(null);
    lastUserMessageRef.current = null;
    tokenCountRef.current = 0;

    // Clear rich event data
    setToolCallEvents([]);
    setAgentEvents([]);
    setOrchestratorStatus({ isActive: false });

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
    enhancedMessages,
    isLoading: isLoading || storage.isLoading, // Simplified - storage loading is now properly managed
    isStreaming,
    error,
    sendMessage,
    sendNegotiationMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
    deleteMessage,
    editMessage,

    // Rich event data (legacy - kept for backward compatibility)
    toolCallEvents,
    agentEvents,
    orchestratorStatus,
    negotiationResult,

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
