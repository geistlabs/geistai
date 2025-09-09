import { ApiClient } from './client';
import EventSource from 'react-native-sse';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ChatRequest {
  message: string;
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

export class ChatAPI {
  constructor(private apiClient: ApiClient) {}

  async sendMessage(message: string): Promise<string> {
    const response = await this.apiClient.request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    return response.response;
  }

  async streamMessage(
    message: string,
    onChunk: (token: string) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<AbortController> {
    const controller = new AbortController();
    
    return new Promise((resolve) => {
      const baseUrl = this.apiClient.getBaseUrl();
      const url = `${baseUrl}/api/chat/stream`;
      
      console.log('[Chat] Starting SSE connection to:', url);
      const connectionStartTime = Date.now();
      
      const es = new EventSource(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ message }),
        withCredentials: false
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
        console.log('[Chat] SSE connection established in:', connectionTime + 'ms');
      });
      
      es.addEventListener('end', (event: any) => {
        const totalTime = Date.now() - connectionStartTime;
        console.log('[Chat] Stream completed in:', totalTime + 'ms');
        onComplete?.();
        es.close();
        resolve(controller);
      });
      
      es.addEventListener('error', (event: any) => {
        const errorTime = Date.now() - connectionStartTime;
        const errorMessage = event.message || event.type || 'Stream connection failed';
        console.error('[Chat] Stream connection error after', errorTime + 'ms:', errorMessage);
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
    return this.apiClient.request<ChatMessage[]>(`/api/chat/history?limit=${limit}`);
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.apiClient.request(`/api/chat/${chatId}`, {
      method: 'DELETE'
    });
  }
}