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
}

export interface STTResponse {
  success: boolean;
  text: string;
  language?: string;
  error?: string;
}

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
      const url = `${baseUrl}/api/chat/stream`;

      // Starting SSE connection
      const connectionStartTime = Date.now();

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
        } catch (e) {
          console.error('[Chat] Failed to parse chunk:', e);
        }
      });

      es.addEventListener('open', (event: any) => {
        const connectionTime = Date.now() - connectionStartTime;
        // SSE connection established
      });

      es.addEventListener('end', (event: any) => {
        const totalTime = Date.now() - connectionStartTime;
        // Stream completed
        onComplete?.();
        es.close();
        resolve(controller);
      });

      es.addEventListener('error', (event: any) => {
        const errorTime = Date.now() - connectionStartTime;
        const errorMessage =
          event.message || event.type || 'Stream connection failed';
        console.error(
          '[Chat] Stream connection error after',
          errorTime + 'ms:',
          errorMessage,
        );
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
  ): Promise<STTResponse> {
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
      console.error('[STT] Transcription failed:', error);
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Transcription failed',
      };
    }
  }
}
