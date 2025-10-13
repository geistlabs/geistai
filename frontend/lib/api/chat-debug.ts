import EventSource from 'react-native-sse';

import { ApiClient } from './client';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ChatRequest {
  message: string;
  messages?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
}

export interface StreamChunk {
  token?: string;
  sequence?: number;
  finished?: boolean;
  error?: string;
  route?: string;
  timing?: {
    connection_time?: number;
    first_token_time?: number;
    total_time?: number;
  };
  metadata?: {
    model?: string;
    tool_calls?: number;
    tokens_per_second?: number;
  };
}

export interface STTResponse {
  success: boolean;
  text: string;
  language?: string;
  error?: string;
}

export interface DebugInfo {
  connectionTime: number;
  firstTokenTime: number;
  totalTime: number;
  tokenCount: number;
  route: string;
  model: string;
  toolCalls: number;
  tokensPerSecond: number;
  chunkCount: number;
  errors: string[];
}

export class ChatAPIDebug {
  private debugInfo: DebugInfo = {
    connectionTime: 0,
    firstTokenTime: 0,
    totalTime: 0,
    tokenCount: 0,
    route: 'unknown',
    model: 'unknown',
    toolCalls: 0,
    tokensPerSecond: 0,
    chunkCount: 0,
    errors: [],
  };

  private startTime: number = 0;
  private firstTokenReceived: boolean = false;

  constructor(private apiClient: ApiClient) {}

  async sendMessage(message: string): Promise<string> {
    console.log(
      '🔤 [ChatAPI] Sending non-streaming message:',
      message.substring(0, 50) + '...',
    );
    const response = await this.apiClient.request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    console.log(
      '✅ [ChatAPI] Non-streaming response received:',
      response.response.substring(0, 100) + '...',
    );
    return response.response;
  }

  async streamMessage(
    message: string,
    onChunk: (token: string) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    messages?: ChatMessage[],
    onDebugInfo?: (info: DebugInfo) => void,
  ): Promise<AbortController> {
    const controller = new AbortController();

    // Validate message
    if (!message) {
      console.error('❌ [ChatAPI] Cannot stream undefined or empty message');
      onError?.(new Error('Message cannot be empty'));
      return controller;
    }

    this.startTime = Date.now();
    this.firstTokenReceived = false;

    // Reset debug info
    this.debugInfo = {
      connectionTime: 0,
      firstTokenTime: 0,
      totalTime: 0,
      tokenCount: 0,
      route: 'unknown',
      model: 'unknown',
      toolCalls: 0,
      tokensPerSecond: 0,
      chunkCount: 0,
      errors: [],
    };

    console.log('🚀 [ChatAPI] Starting stream message:', {
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      messageLength: message.length,
      conversationLength: messages?.length || 0,
      timestamp: new Date().toISOString(),
    });

    return new Promise(resolve => {
      const baseUrl = this.apiClient.getBaseUrl();
      const url = `${baseUrl}/api/chat/stream`;
      const connectionStartTime = Date.now();
      const requestBody = { message, messages: messages || [] };

      console.log('🌐 [ChatAPI] Connecting to:', url);
      console.log(
        '📤 [ChatAPI] Request body:',
        JSON.stringify(requestBody, null, 2),
      );

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
        this.debugInfo.chunkCount++;

        try {
          const data = JSON.parse(event.data) as StreamChunk;
          const chunkTime = Date.now();

          const tokenPreview = data.token
            ? data.token.substring(0, 20) +
              (data.token.length > 20 ? '...' : '')
            : '(empty)';

          console.log(`📦 [ChatAPI] Chunk ${this.debugInfo.chunkCount}:`, {
            sequence: data.sequence,
            token: tokenPreview,
            tokenLength: data.token?.length || 0,
            route: data.route,
            timestamp: new Date().toISOString(),
          });

          // Track first token timing
          if (data.token && !this.firstTokenReceived) {
            this.debugInfo.firstTokenTime = chunkTime - connectionStartTime;
            this.debugInfo.connectionTime = chunkTime - this.startTime;
            this.firstTokenReceived = true;

            console.log('⚡ [ChatAPI] First token received:', {
              connectionTime: this.debugInfo.connectionTime + 'ms',
              firstTokenTime: this.debugInfo.firstTokenTime + 'ms',
              route: data.route,
            });
          }

          // Track route and model info
          if (data.route) {
            this.debugInfo.route = data.route;
          }

          if (data.metadata) {
            if (data.metadata.model) this.debugInfo.model = data.metadata.model;
            if (data.metadata.tool_calls)
              this.debugInfo.toolCalls = data.metadata.tool_calls;
          }

          // Count tokens
          if (data.token) {
            this.debugInfo.tokenCount++;
          }

          // Skip only truly empty tokens, but preserve space-only tokens
          if (data.token !== undefined && data.token !== '') {
            onChunk(data.token);
          }

          // Log every 10th chunk for performance monitoring
          if (this.debugInfo.chunkCount % 10 === 0) {
            const elapsed = chunkTime - connectionStartTime;
            this.debugInfo.tokensPerSecond =
              this.debugInfo.tokenCount / (elapsed / 1000);

            console.log('📊 [ChatAPI] Performance update:', {
              chunkCount: this.debugInfo.chunkCount,
              tokenCount: this.debugInfo.tokenCount,
              elapsed: elapsed + 'ms',
              tokensPerSecond: this.debugInfo.tokensPerSecond.toFixed(2),
              route: this.debugInfo.route,
            });
          }
        } catch (e) {
          const error = `Failed to parse chunk: ${e}`;
          console.error(
            '❌ [ChatAPI] Chunk parsing error:',
            e,
            'Raw data:',
            event.data,
          );
          this.debugInfo.errors.push(error);
        }
      });

      es.addEventListener('open', (event: any) => {
        const connectionTime = Date.now() - connectionStartTime;
        console.log('✅ [ChatAPI] SSE connection established:', {
          connectionTime: connectionTime + 'ms',
          timestamp: new Date().toISOString(),
        });
      });

      es.addEventListener('end', (event: any) => {
        const totalTime = Date.now() - connectionStartTime;
        this.debugInfo.totalTime = totalTime;
        this.debugInfo.tokensPerSecond =
          this.debugInfo.tokenCount / (totalTime / 1000);

        console.log('🏁 [ChatAPI] Stream completed:', {
          totalTime: totalTime + 'ms',
          tokenCount: this.debugInfo.tokenCount,
          chunkCount: this.debugInfo.chunkCount,
          tokensPerSecond: this.debugInfo.tokensPerSecond.toFixed(2),
          route: this.debugInfo.route,
          model: this.debugInfo.model,
          toolCalls: this.debugInfo.toolCalls,
          errors: this.debugInfo.errors.length,
        });

        // Send final debug info
        onDebugInfo?.(this.debugInfo);

        onComplete?.();
        es.close();
        resolve(controller);
      });

      es.addEventListener('error', (event: any) => {
        const errorTime = Date.now() - connectionStartTime;
        const errorMessage =
          event.message || event.type || 'Stream connection failed';

        console.error('❌ [ChatAPI] Stream error:', {
          error: errorMessage,
          errorTime: errorTime + 'ms',
          chunkCount: this.debugInfo.chunkCount,
          tokenCount: this.debugInfo.tokenCount,
          route: this.debugInfo.route,
          timestamp: new Date().toISOString(),
        });

        this.debugInfo.errors.push(
          `Stream error after ${errorTime}ms: ${errorMessage}`,
        );
        onError?.(new Error(errorMessage));
        es.close();
        resolve(controller);
      });

      // Override abort to close EventSource
      const originalAbort = controller.abort.bind(controller);
      controller.abort = () => {
        console.log('🛑 [ChatAPI] Stream aborted by user');
        es.close();
        originalAbort();
      };

      resolve(controller);
    });
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
    console.log('📚 [ChatAPI] Fetching chat history, limit:', limit);
    const history = await this.apiClient.request<ChatMessage[]>(
      `/api/chat/history?limit=${limit}`,
    );
    console.log('📚 [ChatAPI] Chat history retrieved:', {
      messageCount: history.length,
      latestMessage: history[0]?.content?.substring(0, 50) + '...',
    });
    return history;
  }

  async deleteChat(chatId: string): Promise<void> {
    console.log('🗑️ [ChatAPI] Deleting chat:', chatId);
    await this.apiClient.request(`/api/chat/${chatId}`, {
      method: 'DELETE',
    });
    console.log('✅ [ChatAPI] Chat deleted:', chatId);
  }

  async transcribeAudio(
    audioUri: string,
    language?: string,
  ): Promise<STTResponse> {
    console.log('🎤 [ChatAPI] Starting audio transcription:', {
      audioUri: audioUri.substring(0, 50) + '...',
      language: language || 'auto',
    });

    const formData = new FormData();
    formData.append('audio_file', {
      uri: audioUri,
      type: 'audio/wav',
      name: 'recording.wav',
    } as any);

    if (language) {
      formData.append('language', language);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(
        `${this.apiClient.getBaseUrl()}/api/speech-to-text`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const transcriptionTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`STT request failed: ${response.status}`);
      }

      const result = await response.json();

      console.log('🎤 [ChatAPI] Transcription completed:', {
        success: result.success,
        textLength: result.text?.length || 0,
        transcriptionTime: transcriptionTime + 'ms',
        language: result.language,
        error: result.error,
      });

      return result;
    } catch (error) {
      console.error('❌ [ChatAPI] Transcription failed:', error);
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Transcription failed',
      };
    }
  }

  // Get current debug info
  getDebugInfo(): DebugInfo {
    return { ...this.debugInfo };
  }

  // Reset debug info
  resetDebugInfo(): void {
    this.debugInfo = {
      connectionTime: 0,
      firstTokenTime: 0,
      totalTime: 0,
      tokenCount: 0,
      route: 'unknown',
      model: 'unknown',
      toolCalls: 0,
      tokensPerSecond: 0,
      chunkCount: 0,
      errors: [],
    };
  }
}
