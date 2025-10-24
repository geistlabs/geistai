import { ENV } from '../config/environment';
import { revenuecat } from '../revenuecat';

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
    console.log(`${ENV.API_URL}/api/chat`);
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
    console.error('Error sending message:', error);
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
      // Handle end event specially (doesn't have type field)
      if (data.finished === true) {
        // eslint-disable-next-line no-console
        console.log('🏁 Stream finished');
        // Call onComplete to clear loading state
        this.handlers.onComplete?.();
        return;
      }

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

        default:
          if (data.type !== undefined) {
            // eslint-disable-next-line no-console
            console.warn('Unknown event type:', data.type);
          }
      }
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }

  private handleOrchestratorToken(data: any): void {
    if (data.data?.content) {
      this.handlers.onToken(data.data.content);
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
      console.warn('Invalid tool call event data:', {
        eventType,
        toolCallData,
        data,
      });
      return;
    }

    const toolCallEvent = {
      type: eventType.replace('tool_call_', ''),
      toolName: toolCallData.tool_name,
      arguments: toolCallData.arguments,
      result: toolCallData.result,
      error: toolCallData.error,
    };

    console.log(
      `🔧 Sub-agent ${agentName} tool call ${eventType}:`,
      toolCallData.tool_name,
    );
    this.handlers.onToolCallEvent(toolCallEvent);
  }

  private handleToolCallEvent(data: any): void {
    const { type, data: eventData } = data.data;

    if (!eventData?.tool_name) {
      console.warn('Invalid tool call event data:', data);
      return;
    }

    const toolCallEvent = {
      type: type.replace('tool_call_', ''),
      toolName: eventData.tool_name,
      arguments: eventData.arguments,
      result: eventData.result,
      error: eventData.error,
    };

    console.log(`🔧 Tool call ${type}:`, eventData.tool_name);
    this.handlers.onToolCallEvent(toolCallEvent);
  }

  private handleOrchestratorStart(data: any): void {
    const orchestratorName = data.data?.orchestrator || 'unknown';
    const input = data.data?.input || '';
    // eslint-disable-next-line no-console
    console.log(`🎯 Orchestrator started: ${orchestratorName}`, { input });
  }

  private handleOrchestratorComplete(data: any): void {
    const orchestratorName = data.data?.orchestrator || 'unknown';
    const status = data.data?.status || 'unknown';
    // eslint-disable-next-line no-console
    console.log(`✅ Orchestrator completed: ${orchestratorName}`, { status });
  }

  private handleFinalResponse(data: any): void {
    const text = data.text || data.data?.text || 'no response';
    const status = data.status || data.data?.status || 'unknown';
    // eslint-disable-next-line no-console
    console.log('📄 Final response received', { status, length: text.length });
  }

  private handleError(data: any): void {
    const message = data.message || data.data?.message || 'Unknown error';
    // eslint-disable-next-line no-console
    console.error('❌ Stream error:', message);
    this.handlers.onError(message);
  }
}

// Send a streaming message to the negotiation API
export async function sendNegotiationMessage(
  message: string,
  conversationHistory: ChatMessage[],
  handlers: StreamEventHandlers,
): Promise<void> {
  const requestBody: ChatRequest = {
    message,
    messages: conversationHistory,
  };

  // Create event processor
  const eventProcessor = new StreamEventProcessor(handlers);

  return new Promise<void>(async (resolve, reject) => {
    try {
      console.log(`[Negotiate] Sending to ${ENV.API_URL}/api/negotiate`);

      // Get user ID for premium verification
      const userId = await revenuecat.getAppUserId();

      const response = await fetch(`${ENV.API_URL}/api/negotiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-User-ID': userId,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        reject(new Error(`HTTP ${response.status}: ${errorText}`));
        return;
      }

      // Manual SSE parsing
      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback: Try to get response as text for non-streaming responses
        try {
          const text = await response.text();
          console.log('Response text:', text);
          // Try to parse as SSE format
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                eventProcessor.processEvent(parsed);
              } catch {
                // Skip non-JSON lines
              }
            }
          }
          resolve();
        } catch (error) {
          reject(
            new Error('Failed to read response: ' + (error as Error).message),
          );
        }
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              eventProcessor.processEvent(data);
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
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

  // Create event processor
  const eventProcessor = new StreamEventProcessor(handlers);

  return new Promise<void>(async (resolve, reject) => {
    try {
      console.log(`${ENV.API_URL}/api/stream`);

      // Get user ID for premium verification
      const userId = await revenuecat.getAppUserId();

      const response = await fetch(`${ENV.API_URL}/api/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-User-ID': userId,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        reject(new Error(`HTTP ${response.status}: ${errorText}`));
        return;
      }

      // Manual SSE parsing
      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback: Try to get response as text for non-streaming responses
        try {
          const text = await response.text();
          console.log('Response text:', text);
          // Try to parse as SSE format
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                eventProcessor.processEvent(parsed);
              } catch {
                // Skip non-JSON lines
              }
            }
          }
          resolve();
        } catch (error) {
          reject(
            new Error('Failed to read response: ' + (error as Error).message),
          );
        }
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          resolve();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              resolve();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              eventProcessor.processEvent(parsed);
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }
    } catch (error) {
      reject(error);
    }
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

// Health check function
export async function checkHealth(): Promise<{
  status: string;
  ssl_enabled: boolean;
  ssl_status: string;
}> {
  try {
    const response = await fetch(`${ENV.API_URL}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Health check error:', error);
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

    try {
      const baseUrl = this.apiClient.getBaseUrl();
      const url = `${baseUrl}/api/stream`;

      // Get user ID for premium verification
      const userId = await revenuecat.getAppUserId();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-User-ID': userId,
        },
        body: JSON.stringify({ message, messages: messages || [] }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        onError?.(new Error(`HTTP ${response.status}: ${errorText}`));
        return controller;
      }

      // Manual SSE parsing
      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback: Try to get response as text for non-streaming responses
        try {
          const text = await response.text();
          console.log('Response text:', text);
          // Try to parse as SSE format
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                if (parsed.data?.content) {
                  onChunk(parsed.data.content);
                } else if (parsed.text) {
                  onChunk(parsed.text);
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }
          onComplete?.();
        } catch (error) {
          onError?.(
            new Error('Failed to read response: ' + (error as Error).message),
          );
        }
        return controller;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const readChunk = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              onComplete?.();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  onComplete?.();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  // Handle different event types
                  if (parsed.data?.content) {
                    onChunk(parsed.data.content);
                  } else if (parsed.text) {
                    // Handle final_response
                    onChunk(parsed.text);
                  } else if (typeof parsed === 'string') {
                    onChunk(parsed);
                  }
                } catch {
                  // Skip non-JSON lines
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            onError?.(error as Error);
          }
        }
      };

      readChunk();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        onError?.(error as Error);
      }
    }

    return controller;
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
}
