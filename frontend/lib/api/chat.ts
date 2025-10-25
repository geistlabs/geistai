import EventSource from 'react-native-sse';

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

export interface NegotiationResult {
  final_price: number;
  package_id: string;
  negotiation_summary: string;
}

// Parse negotiation result from agent message content
export function parseNegotiationResult(
  content: string,
): NegotiationResult | null {
  try {
    console.log(
      '🔍 [DEBUG] parseNegotiationResult called with content:',
      content,
    );

    // Look for JSON block in the content
    const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    console.log('🔍 [DEBUG] JSON regex match result:', jsonMatch);

    if (!jsonMatch) {
      console.log('❌ [DEBUG] No JSON block found in content');
      return null;
    }

    const jsonStr = jsonMatch[1];
    console.log('🔍 [DEBUG] Extracted JSON string:', jsonStr);
    const parsed = JSON.parse(jsonStr);
    console.log('🔍 [DEBUG] Parsed JSON object:', parsed);

    // Validate required fields
    if (
      typeof parsed.final_price !== 'number' ||
      typeof parsed.package_id !== 'string' ||
      typeof parsed.negotiation_summary !== 'string'
    ) {
      console.warn('Invalid negotiation result structure:', parsed);
      return null;
    }

    // Validate final_price is one of the expected values
    const validPrices = [19.99, 29.99, 39.99];
    if (!validPrices.includes(parsed.final_price)) {
      console.warn('Invalid final_price:', parsed.final_price);
      return null;
    }

    // Validate package_id matches expected format
    const validPackageIds = [
      'premium_monthly_20',
      'premium_monthly_30',
      'premium_monthly_40',
    ];
    if (!validPackageIds.includes(parsed.package_id)) {
      console.warn('Invalid package_id:', parsed.package_id);
      return null;
    }

    return parsed as NegotiationResult;
  } catch (error) {
    console.warn('Failed to parse negotiation result:', error);
    return null;
  }
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
  onNegotiationResult?: (result: NegotiationResult) => void;
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
        case 'agent_token':
          this.handleAgentToken(data);
          break;
        case 'agent_start':
          this.handleAgentStart(data);
          break;
        case 'agent_complete':
          this.handleAgentComplete(data);
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
      console.error('Error processing event:', error);
    }
  }

  private handleOrchestratorToken(data: any): void {
    console.log('whatch me handle token pal', data.data?.data);
    if (data.data?.channel === 'content') {
      this.handlers.onToken(data.data.data);
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
    console.log('🎯 Orchestrator started:', data.data.orchestrator);
  }

  private handleOrchestratorComplete(data: any): void {
    console.log('✅ Orchestrator completed:', data.data.orchestrator);
  }

  private handleFinalResponse(data: any): void {
    console.log('📄 Final response received');
    console.log('Citations:', data.citations?.length || 0);
  }

  private handleError(data: any): void {
    console.error('❌ Stream error:', data.message);
    this.handlers.onError(data.message || 'Unknown error');
  }

  // Agent event handlers for /api/negotiate endpoint
  private handleAgentToken(data: any): void {
    // Agent now emits same format as orchestrator: {channel, data}
    console.log('🤖 Agent token:', data.data?.data);
    if (data.data?.channel === 'content') {
      this.handlers.onToken(data.data.data);
    }
  }

  private handleAgentStart(data: any): void {
    console.log('🤖 Agent started:', data.data?.agent);
  }

  private handleAgentComplete(data: any): void {
    console.log('✅ Agent completed:', data.data?.agent);
    console.log(
      '🔍 [DEBUG] Full agent_complete data:',
      JSON.stringify(data, null, 2),
    );

    // Check if this is a pricing agent completion and parse negotiation result
    if (data.data?.agent === 'pricing_agent' && data.data?.text) {
      console.log('🔍 [DEBUG] Pricing agent text content:', data.data.text);
      const negotiationResult = parseNegotiationResult(data.data.text);
      if (negotiationResult) {
        console.log('💰 Negotiation result parsed:', negotiationResult);
        this.handlers.onNegotiationResult?.(negotiationResult);
      } else {
        console.log(
          '❌ [DEBUG] Failed to parse negotiation result from text:',
          data.data.text,
        );
      }
    } else {
      console.log('🔍 [DEBUG] Not pricing agent or no text:', {
        agent: data.data?.agent,
        hasText: !!data.data?.text,
        isPricingAgent: data.data?.agent === 'pricing_agent',
      });
    }
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

  // 🔍 DEBUG: Log the FULL prompt being sent to backend
  console.log(
    '🚀 [Chat API] ===== FULL PROMPT BEING SENT TO /api/stream =====',
  );
  console.log('🚀 [Chat API] User Message:', message);
  console.log(
    '🚀 [Chat API] Conversation History Length:',
    conversationHistory.length,
  );
  console.log(
    '🚀 [Chat API] Full Request Body:',
    JSON.stringify(requestBody, null, 2),
  );

  // Log each message in the conversation history for debugging
  conversationHistory.forEach((msg, index) => {
    console.log(
      `🚀 [Chat API] Message ${index + 1} [${msg.role}]:`,
      msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
    );
  });
  console.log('🚀 [Chat API] ============================================');

  // Create event processor
  const eventProcessor = new StreamEventProcessor(handlers);

  return new Promise<void>(async (resolve, reject) => {
    console.log(`${ENV.API_URL}/api/stream`);

    const userId = await revenuecat.getAppUserId();
    console.log('🚀 [Chat API] User ID:', userId);
    // Create EventSource with POST data
    const es = new EventSource(`${ENV.API_URL}/api/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-User-ID': userId,
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
        console.warn(
          'Failed to parse orchestrator_token:',
          parseError,
          'Raw data:',
          event.data,
        );
      }
    });

    es.addEventListener('sub_agent_event', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse sub_agent_event:',
          parseError,
          'Raw data:',
          event.data,
        );
      }
    });

    es.addEventListener('tool_call_event', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse tool_call_event:',
          parseError,
          'Raw data:',
          event.data,
        );
      }
    });

    es.addEventListener('orchestrator_start', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse orchestrator_start:',
          parseError,
          'Raw data:',
          event.data,
        );
      }
    });

    es.addEventListener('orchestrator_complete', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse orchestrator_complete:',
          parseError,
          'Raw data:',
          event.data,
        );
      }
    });

    es.addEventListener('final_response', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse final_response:',
          parseError,
          'Raw data:',
          event.data,
        );
      }
    });

    es.addEventListener('error', (event: any) => {
      try {
        // Try to extract error message from event
        let errorMessage = 'Stream error occurred';

        // Check if there's a message property (backend error)
        if (event.message) {
          try {
            // Try to parse JSON detail from message
            const parsed = JSON.parse(event.message);
            errorMessage = parsed.detail || event.message;
          } catch {
            // If not JSON, use the message as-is
            errorMessage = event.message;
          }
        }

        // Check HTTP status for premium errors
        if (event.xhrStatus === 403) {
          errorMessage = 'Premium subscription required to use this feature';
        } else if (event.xhrStatus === 401) {
          errorMessage = 'Authentication failed - please log in again';
        }

        console.warn('Stream error:', errorMessage);
        handlers.onError(errorMessage);

        // ✅ CLOSE THE CONNECTION AND STOP
        es.close();
        reject(new Error(errorMessage));

        if (event.data && typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            eventProcessor.processEvent(data);
          } catch {
            // Skip if can't parse
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse error event:', parseError);
        handlers.onError('Stream connection error');
        es.close();
        reject(new Error('Stream connection error'));
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
        console.warn(
          'Failed to parse end event data:',
          parseError,
          'Raw data:',
          event.data,
        );
      }

      handlers.onComplete();
      es.close();
      resolve();
    });

    es.addEventListener('open', (event: any) => {
      console.log('SSE connection established');
    });

    // Handle connection errors
    es.onerror = error => {
      console.error('EventSource error:', error);
      handlers.onError('Connection failed');
      es.close();
      reject(new Error('Connection failed'));
    };

    // Handle general errors
    es.onopen = () => {
      console.log('EventSource opened');
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
}

// Negotiation-specific functionality
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
    console.log(`[Negotiate] Sending to ${ENV.API_URL}/api/negotiate`);

    const userId = await revenuecat.getAppUserId();
    console.log('[Negotiate] User ID:', userId);

    // Use EventSource just like /api/stream
    const es = new EventSource(`${ENV.API_URL}/api/negotiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-User-ID': userId,
      },
      body: JSON.stringify(requestBody),
      withCredentials: false,
    });

    // Handle different event types (same as /api/stream + agent events for /api/negotiate)
    es.addEventListener('orchestrator_token', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          '[Negotiate] Failed to parse orchestrator_token:',
          parseError,
        );
      }
    });

    // Add agent event listeners for /api/negotiate endpoint
    es.addEventListener('agent_token', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn('[Negotiate] Failed to parse agent_token:', parseError);
      }
    });

    es.addEventListener('agent_start', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn('[Negotiate] Failed to parse agent_start:', parseError);
      }
    });

    es.addEventListener('agent_complete', (event: any) => {
      try {
        console.log('🔍 [DEBUG] agent_complete event received:', event);
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          console.log('🔍 [DEBUG] Parsed agent_complete data:', data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn('[Negotiate] Failed to parse agent_complete:', parseError);
        console.log('🔍 [DEBUG] Raw agent_complete event data:', event.data);
      }
    });

    es.addEventListener('sub_agent_event', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          '[Negotiate] Failed to parse sub_agent_event:',
          parseError,
        );
      }
    });

    es.addEventListener('tool_call_event', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          '[Negotiate] Failed to parse tool_call_event:',
          parseError,
        );
      }
    });

    es.addEventListener('orchestrator_start', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          '[Negotiate] Failed to parse orchestrator_start:',
          parseError,
        );
      }
    });

    es.addEventListener('orchestrator_complete', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn(
          '[Negotiate] Failed to parse orchestrator_complete:',
          parseError,
        );
      }
    });

    es.addEventListener('final_response', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn('[Negotiate] Failed to parse final_response:', parseError);
      }
    });

    es.addEventListener('error', (event: any) => {
      try {
        let errorMessage = 'Stream error occurred';

        if (event.message) {
          try {
            const parsed = JSON.parse(event.message);
            errorMessage = parsed.detail || event.message;
          } catch {
            errorMessage = event.message;
          }
        }

        if (event.xhrStatus === 403) {
          errorMessage = 'Premium subscription required to use this feature';
        } else if (event.xhrStatus === 401) {
          errorMessage = 'Authentication failed - please log in again';
        }

        console.warn('[Negotiate] Stream error:', errorMessage);
        handlers.onError(errorMessage);

        es.close();
        reject(new Error(errorMessage));
      } catch (parseError) {
        console.warn('[Negotiate] Failed to parse error event:', parseError);
        handlers.onError('Stream connection error');
        es.close();
        reject(new Error('Stream connection error'));
      }
    });

    es.addEventListener('end', (event: any) => {
      try {
        if (event.data && typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          eventProcessor.processEvent(data);
        }
      } catch (parseError) {
        console.warn('[Negotiate] Failed to parse end event data:', parseError);
      }

      console.log('[Negotiate] ✅ Stream ended');
      handlers.onComplete();
      es.close();
      resolve();
    });

    es.addEventListener('open', (event: any) => {
      console.log('[Negotiate] SSE connection established');
    });

    es.onerror = error => {
      console.error('[Negotiate] EventSource error:', error);
      handlers.onError('Connection failed');
      es.close();
      reject(new Error('Connection failed'));
    };

    es.onopen = () => {
      console.log('[Negotiate] EventSource opened');
    };
  });
}
