// API client for embeddings service

export interface EmbedRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}

export interface EmbedResponse {
  object: string;
  data: EmbeddingData[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: string;
  data: ModelInfo[];
}

const EMBEDDINGS_API_BASE = 'http://localhost:8001'; // Adjust based on your embeddings service port

export class EmbeddingsAPI {
  private baseUrl: string;

  constructor(baseUrl: string = EMBEDDINGS_API_BASE) {
    this.baseUrl = baseUrl;
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const response = await fetch(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: request.input,
        model: request.model || 'all-MiniLM-L6-v2'
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getModels(): Promise<ModelsResponse> {
    const response = await fetch(`${this.baseUrl}/models`);

    if (!response.ok) {
      throw new Error(`Models request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const embeddingsAPI = new EmbeddingsAPI();
