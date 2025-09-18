import React, { useState } from 'react';
import { embeddingsAPI, EmbedRequest } from '../../api/embeddings';
import { embeddingDB, StoredEmbedding } from '../../lib/indexedDB';

interface EmbeddingCreatorProps {
  onEmbeddingCreated: (embedding: StoredEmbedding) => void;
  chatId?: string; // Optional chat ID to associate with the embedding
}

const EmbeddingCreator: React.FC<EmbeddingCreatorProps> = ({ onEmbeddingCreated, chatId }) => {
  const [text, setText] = useState('');
  const [model, setModel] = useState('all-MiniLM-L6-v2');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  React.useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const response = await embeddingsAPI.getModels();
      setAvailableModels(response.data.map(m => m.id));
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: EmbedRequest = {
        input: text.trim(),
        model
      };

      const response = await embeddingsAPI.embed(request);
      
      if (response.data.length > 0) {
        const embeddingData = response.data[0];
        
        const storedEmbedding: Omit<StoredEmbedding, 'id' | 'createdAt'> = {
          text: text.trim(),
          embedding: embeddingData.embedding,
          model: response.model,
          chatId: chatId, // Associate with chat if provided
          metadata: {
            usage: response.usage,
            source: 'manual_creation'
          }
        };

        const id = await embeddingDB.saveEmbedding(storedEmbedding);
        const fullEmbedding: StoredEmbedding = {
          ...storedEmbedding,
          id,
          createdAt: new Date()
        };

        onEmbeddingCreated(fullEmbedding);
        setText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create embedding');
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    marginBottom: '20px'
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '100px',
    resize: 'vertical'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  };

  const buttonDisabledStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  };

  const errorStyle: React.CSSProperties = {
    color: '#dc3545',
    fontSize: '14px',
    marginTop: '10px'
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Create New Embedding</h3>
      
      <form onSubmit={handleSubmit} style={formStyle}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Text to Embed:
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to create embedding for..."
            style={textareaStyle}
            disabled={isLoading}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Model:
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={inputStyle}
            disabled={isLoading}
          >
            {availableModels.map(modelId => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading || !text.trim()}
          style={isLoading || !text.trim() ? buttonDisabledStyle : buttonStyle}
        >
          {isLoading ? 'Creating...' : 'Create Embedding'}
        </button>

        {error && (
          <div style={errorStyle}>
            Error: {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default EmbeddingCreator;
