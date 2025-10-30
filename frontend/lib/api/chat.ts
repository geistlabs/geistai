import EventSource from 'react-native-sse';

import { ENV } from '../config/environment';

import { ApiClient } from './client';
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface AgentMessage {
  agent: string;
  content: string;
  timestamp: number;
  type: 'start' | 'token' | 'complete' | 'error';
  status?: string;
  citations?: any[];
  meta?: any;
}

export interface ChatRequest {
  message: string;
  messages?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
}

export interface ChatError {
  error: string;
}

// Send a message to the chat API (non-streaming)
export async function sendMessage(
  message: string,
  conversationHistory?: ChatMessage[],
): Promise<{ content: string }> {
  const requestBody: ChatRequest = {
    message,
    messages: conversationHistory,
  };

  try {
    const response = await fetch(`${ENV.API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: ChatResponse = await response.json();
    return { content: data.response };
  } catch (error) {
    throw error;
  }
}

// Streaming chat interface
export interface StreamChunk {
  token: string;
  sequence: number;
}

export interface StreamEnd {
  finished: boolean;
}

export interface StreamError {
  error: string;
}

export type StreamEvent = StreamChunk | StreamEnd | StreamError;

// Event handler interfaces for cleaner code organization
export interface StreamEventHandlers {
  onToken: (token: string) => void;
  onReasoningToken: (token: string) => void;
  onSubAgentEvent: (agentEvent: {
    agent: string;
    token: string;
    isStreaming?: boolean;
    task?: string;
    context?: string;
  }) => void;
  onToolCallEvent: (toolCallEvent: {
    type: string;
    toolName: string;
    arguments?: any;
    result?: any;
    error?: string;
  }) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

// Event processor class for handling different event types
class StreamEventProcessor {
  private handlers: StreamEventHandlers;

  constructor(handlers: StreamEventHandlers) {
    this.handlers = handlers;
  }

  processEvent(data: any): void {
    try {
      switch (data.type) {
        case 'orchestrator_token':
          this.handleOrchestratorToken(data);
          break;
        case 'sub_agent_event':
          this.handleSubAgentEvent(data);
          break;
        case 'tool_call_event':
          this.handleToolCallEvent(data);
          break;
        case 'orchestrator_start':
          this.handleOrchestratorStart(data);
          break;
        case 'orchestrator_complete':
          this.handleOrchestratorComplete(data);
          break;
        case 'final_response':
          this.handleFinalResponse(data);
          break;
        case 'error':
          this.handleError(data);
          break;
        default:
      }
    } catch (error) {
      // Error processing event
    }
  }

  private handleOrchestratorToken(data: any): void {
    if (
      data.data?.channel === 'content' &&
      typeof data.data.data === 'string'
    ) {
      this.handlers.onToken(data.data.data);
    }
    if (
      data.data?.channel === 'reasoning' &&
      typeof data.data.data === 'string'
    ) {
      this.handlers.onReasoningToken(data.data.data);
    }
  }

  private handleSubAgentEvent(data: any): void {
    const { type, data: eventData } = data.data;

    switch (type) {
      case 'agent_token':
        if (eventData?.content) {
          this.handlers.onSubAgentEvent({
            agent: eventData.agent,
            token: eventData.content,
          });
        }
        break;
      case 'agent_start':
        this.handlers.onSubAgentEvent({
          agent: eventData.agent,
          token: 'Starting...',
          isStreaming: true,
          task: eventData.input,
          context: eventData.context,
        });
        break;
      case 'agent_complete':
        this.handlers.onSubAgentEvent({
          agent: eventData.agent,
          token: eventData.content,
          isStreaming: false,
        });
        break;
      case 'tool_call_event':
        this.handleSubAgentToolCall(data);
        break;
    }
  }

  private handleSubAgentToolCall(data: any): void {
    const toolCallEventData = data.data.data;
    const toolCallData = toolCallEventData.data;
    const eventType = toolCallEventData.type;
    const agentName = data.data.agent;

    if (!toolCallData?.tool_name) {
      return;
    }

    const toolCallEvent = {
      type: eventType.replace('tool_call_', ''),
      toolName: toolCallData.tool_name,
      arguments: toolCallData.arguments,
      result: toolCallData.result,
      error: toolCallData.error,
    };

    this.handlers.onToolCallEvent(toolCallEvent);
  }

  private handleToolCallEvent(data: any): void {
    const { type, data: eventData } = data.data;

    if (!eventData?.tool_name) {
      return;
    }

    const toolCallEvent = {
      type: type.replace('tool_call_', ''),
      toolName: eventData.tool_name,
      arguments: eventData.arguments,
      result: eventData.result,
      error: eventData.error,
    };

    this.handlers.onToolCallEvent(toolCallEvent);
  }

  private handleOrchestratorStart(data: any): void {
    // Orchestrator started
  }

  private handleOrchestratorComplete(data: any): void {
    // Orchestrator completed
  }

  private handleFinalResponse(data: any): void {
    // Final response received
  }

  private handleError(data: any): void {
    this.handlers.onError(data.message || 'Unknown error');
  }
}

// Send a streaming message to the chat API
export async function sendStreamingMessage(
  message: string,
  conversationHistory: ChatMessage[],
  handlers: StreamEventHandlers,
): Promise<void> {
  const requestBody: ChatRequest = {
    message,
    messages: conversationHistory,
  };

  console.log('[StreamingAPI] 🚀 Sending streaming message to /api/stream');
  console.log(
    `[StreamingAPI] 📝 Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
  );
  console.log(
    `[StreamingAPI] 📚 Conversation history length: ${conversationHistory.length} messages`,
  );
  console.log('[StreamingAPI] 📋 Full request body:');
  console.log(`[StreamingAPI] Message: "${requestBody.message}"`);
  console.log('[StreamingAPI] Messages array:');
  requestBody.messages?.forEach((msg, index) => {
    console.log(
      `[StreamingAPI] ${index + 1}. [${msg.role}] ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`,
    );
  });

  // Create event processor
  const eventProcessor = new StreamEventProcessor(handlers);

  return new Promise<void>((resolve, reject) => {
    // Create EventSource with POST data
    const es = new EventSource(`${ENV.API_URL}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      withCredentials: false,
    });

    // Handle different event types
    es.addEventListener('orchestrator_token', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse orchestrator_token
      }
    });

    es.addEventListener('sub_agent_event', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse sub_agent_event
      }
    });

    es.addEventListener('tool_call_event', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse tool_call_event
      }
    });

    es.addEventListener('orchestrator_start', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse orchestrator_start
      }
    });

    es.addEventListener('orchestrator_complete', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse orchestrator_complete
      }
    });

    es.addEventListener('final_response', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse final_response
      }
    });

    es.addEventListener('error', (event: any) => {
      try {
        // Only try to parse if event.data exists and is a string
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        } else {
          // Handle error events without data
          handlers.onError('Stream error occurred');
        }
      } catch (parseError) {
        // Failed to parse error event
      }
    });

    es.addEventListener('end', (event: any) => {
      try {
        // Check if there's any data to process before completing
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse end event data
      }

      handlers.onComplete();
      es.close();
      resolve();
    });

    es.addEventListener('open', (event: any) => {
      // SSE connection established
    });

    // Handle connection errors
    es.onerror = error => {
      handlers.onError('Connection failed');
      es.close();
      reject(new Error('Connection failed'));
    };

    // Handle general errors
    es.onopen = () => {
      // EventSource opened
    };
  });
}

// Agent message utilities
export function createAgentMessage(
  agent: string,
  content: string,
  type: 'start' | 'token' | 'complete' | 'error',
  status?: string,
  citations?: any[],
  meta?: any,
): AgentMessage {
  return {
    agent,
    content,
    timestamp: Date.now(),
    type,
    status,
    citations,
    meta,
  };
}

export function groupAgentMessagesByAgent(
  messages: AgentMessage[],
): Record<string, AgentMessage[]> {
  return messages.reduce(
    (groups, message) => {
      if (!groups[message.agent]) {
        groups[message.agent] = [];
      }
      groups[message.agent].push(message);
      return groups;
    },
    {} as Record<string, AgentMessage[]>,
  );
}

export function getAgentDisplayName(agentName: string): string {
  const displayNames: Record<string, string> = {
    main_orchestrator: 'Main Orchestrator',
    research_agent: 'Research Agent',
    current_info_agent: 'Current Info Agent',
    creative_agent: 'Creative Agent',
    technical_agent: 'Technical Agent',
    summary_agent: 'Summary Agent',
  };
  return (
    displayNames[agentName] ||
    agentName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  );
}

// Send a negotiation message to the pricing agent
export async function sendNegotiationMessage(
  message: string,
  conversationHistory: ChatMessage[],
  handlers: StreamEventHandlers,
): Promise<void> {
  const requestBody: ChatRequest = {
    message,
    messages: conversationHistory,
  };

  console.log(
    '[NegotiationAPI] 🚀 Sending negotiation message to /api/negotiate',
  );

  // Create event processor
  const eventProcessor = new StreamEventProcessor(handlers);

  return new Promise<void>((resolve, reject) => {
    // Create EventSource with POST data
    const es = new EventSource(`${ENV.API_URL}/api/negotiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      withCredentials: false,
    });

    // Handle different event types
    es.addEventListener('agent_start', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse agent_start
      }
    });

    es.addEventListener('agent_token', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse agent_token
      }
    });

    es.addEventListener('agent_complete', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse agent_complete
      }
    });

    es.addEventListener('negotiation_finalized', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse negotiation_finalized
      }
    });

    es.addEventListener('final_response', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse final_response
      }
    });

    es.addEventListener('error', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        } else {
          handlers.onError('Negotiation stream error occurred');
        }
      } catch (parseError) {
        // Failed to parse error event
      }
    });

    es.addEventListener('end', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        // Failed to parse end event data
      }

      handlers.onComplete();
      es.close();
      resolve();
    });

    es.addEventListener('open', (event: any) => {
      // SSE connection established
    });

    // Handle connection errors
    es.onerror = error => {
      handlers.onError('Negotiation connection failed');
      es.close();
      reject(new Error('Negotiation connection failed'));
    };

    // Handle general errors
    es.onopen = () => {
      // EventSource opened
    };
  });
}

// Health check function
export async function checkHealth(): Promise<{
  status: string;
}> {
  try {
    const response = await fetch(`${ENV.API_URL}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Legacy ChatAPI class for backward compatibility
export class ChatAPI {
  constructor(private apiClient: ApiClient) {}

  async sendMessage(message: string): Promise<string> {
    const response = await this.apiClient.request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return response.response;
  }

  async streamMessage(
    message: string,
    onChunk: (token: string) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    messages?: ChatMessage[],
  ): Promise<AbortController> {
    const controller = new AbortController();

    return new Promise(resolve => {
      const baseUrl = this.apiClient.getBaseUrl();
      const url = `${baseUrl}/api/stream`;

      // Starting SSE connection
      const requestBody = { message, messages: messages || [] };
      // Sending request to backend

      const es = new EventSource(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        withCredentials: false,
      });

      // Store EventSource in controller for cleanup
      (controller as any).eventSource = es;

      es.addEventListener('chunk', (event: any) => {
        try {
          const data = JSON.parse(event.data) as StreamChunk;

          // Skip only truly empty tokens, but preserve space-only tokens
          if (data.token !== undefined && data.token !== '') {
            onChunk(data.token);
          }
        } catch {
          // console.error('[Chat] Failed to parse chunk:', e);
        }
      });

      es.addEventListener('open', (event: any) => {
        // SSE connection established
      });

      es.addEventListener('end', (event: any) => {
        // Stream completed
        onComplete?.();
        es.close();
        resolve(controller);
      });

      es.addEventListener('error', (event: any) => {
        let errorMessage = 'Stream connection failed';

        try {
          // Try to parse as structured error event
          const errorData = JSON.parse(event.data || '{}');
          if (errorData.type === 'error') {
            errorMessage = errorData.message || errorMessage;
          } else {
            errorMessage = event.message || event.type || errorMessage;
          }
        } catch {
          // Fallback to legacy error handling
          errorMessage = event.message || event.type || errorMessage;
        }

        // console.error('[Chat] Stream connection error:', errorMessage);
        onError?.(new Error(errorMessage));
        es.close();
        resolve(controller);
      });

      // Override abort to close EventSource
      const originalAbort = controller.abort.bind(controller);
      controller.abort = () => {
        es.close();
        originalAbort();
      };

      resolve(controller);
    });
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
    return this.apiClient.request<ChatMessage[]>(
      `/api/chat/history?limit=${limit}`,
    );
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.apiClient.request(`/api/chat/${chatId}`, {
      method: 'DELETE',
    });
  }

  async transcribeAudio(
    audioUri: string,
    language?: string,
  ): Promise<{
    success: boolean;
    text: string;
    language?: string;
    error?: string;
  }> {
    // Create FormData for file upload
    const formData = new FormData();

    // Add the audio file - React Native FormData expects the file object directly
    formData.append('audio_file', {
      uri: audioUri,
      type: 'audio/wav',
      name: 'recording.wav',
    } as any);

    // Add language if specified
    if (language) {
      formData.append('language', language);
    }

    try {
      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/api/speech-to-text`,
        {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header - let fetch set it with boundary for multipart/form-data
        },
      );

      if (!response.ok) {
        throw new Error(`STT request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // console.error('[STT] Transcription failed:', error);
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Transcription failed',
      };
    }
  }

  async sendNegotiationMessage(
    message: string,
    conversationHistory: ChatMessage[],
    handlers: StreamEventHandlers,
  ): Promise<void> {
    return sendNegotiationMessage(message, conversationHistory, handlers);
  }
}
