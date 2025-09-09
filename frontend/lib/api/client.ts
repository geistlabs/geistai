export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public retryable: boolean = false,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private abortControllers = new Map<string, AbortController>();
  
  constructor(private config: ApiConfig) {}
  
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 15000;
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  }

  async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    attempt: number = 0
  ): Promise<T> {
    const requestId = Math.random().toString(36);
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);
      
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      if (!response.ok) {
        const isRetryable = response.status >= 500;
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.message || `HTTP ${response.status}`,
          isRetryable,
          response.status,
          errorData
        );
      }

      return response.json();
    } catch (error) {
      this.abortControllers.delete(requestId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', true);
      }
      
      if (error instanceof ApiError && error.retryable && attempt < this.config.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, attempt + 1);
      }
      throw error;
    }
  }

  async stream(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ReadableStream<Uint8Array>> {
    const requestId = Math.random().toString(36);
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);
      
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.message || `Stream request failed: HTTP ${response.status}`,
          false,
          response.status,
          errorData
        );
      }

      if (!response.body) {
        throw new ApiError('No response body for stream');
      }

      return response.body;
    } catch (error) {
      this.abortControllers.delete(requestId);
      throw error;
    }
  }

  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  cancelAll(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }
}
