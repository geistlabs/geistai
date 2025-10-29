import { StreamingService } from '../services/StreamingService';
import {
  AgentConversation,
  EnhancedMessage,
  ToolCallEvent,
} from '../types/ChatTypes';

export interface TokenHandlerConfig {
  messageId: string;
  streamingService: StreamingService;
  onUpdateMessage: (id: string, content: string) => void;
  onUpdateEnhancedMessage: (
    id: string,
    updates: Partial<EnhancedMessage>,
  ) => void;
}

export function createTokenHandler(config: TokenHandlerConfig) {
  const {
    messageId,
    streamingService,
    onUpdateMessage,
    onUpdateEnhancedMessage,
  } = config;

  return (token: string) => {
    streamingService.addToken(token);
    onUpdateMessage(messageId, token);
    onUpdateEnhancedMessage(messageId, {
      content: streamingService.getAccumulatedContent(),
    });
  };
}

export interface SubAgentHandlerConfig {
  messageId: string;
  onUpdateEnhancedMessage: (
    id: string,
    updates: Partial<EnhancedMessage>,
  ) => void;
}

export function createSubAgentHandler(config: SubAgentHandlerConfig) {
  const { messageId, onUpdateEnhancedMessage } = config;

  return (agentEvent: {
    agent: string;
    token: string;
    isStreaming?: boolean;
    task?: string;
    context?: string;
  }) => {
    const { agent, token, isStreaming, task, context } = agentEvent;

    const newConversation: AgentConversation = {
      agent,
      timestamp: new Date(),
      type: isStreaming ? 'start' : 'complete',
      task,
      context,
      messages: [
        {
          id: token,
          content: token,
          role: 'assistant',
          timestamp: Date.now(),
          isStreaming,
        },
      ],
    };

    onUpdateEnhancedMessage(messageId, {
      agentConversations: [newConversation],
    });
  };
}

export interface ToolCallHandlerConfig {
  messageId: string;
  onUpdateEnhancedMessage: (
    id: string,
    updates: Partial<EnhancedMessage>,
  ) => void;
}

export function createToolCallHandler(config: ToolCallHandlerConfig) {
  const { messageId, onUpdateEnhancedMessage } = config;

  return (toolCallEvent: {
    type: 'start' | 'complete' | 'error';
    toolName: string;
    arguments?: any;
    result?: any;
    error?: string;
  }) => {
    const eventId = `${toolCallEvent.toolName}-${Date.now()}-${Math.random()}`;

    const newEvent: ToolCallEvent = {
      id: eventId,
      type: toolCallEvent.type,
      toolName: toolCallEvent.toolName,
      arguments: toolCallEvent.arguments,
      result: toolCallEvent.result,
      error: toolCallEvent.error,
      timestamp: new Date(),
      status:
        toolCallEvent.type === 'complete'
          ? 'completed'
          : toolCallEvent.type === 'error'
            ? 'error'
            : 'active',
    };

    onUpdateEnhancedMessage(messageId, {
      toolCallEvents: [newEvent],
    });
  };
}
