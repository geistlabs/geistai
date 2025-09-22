import React, { useState } from 'react';
import { StoredEmbedding } from '../../lib/indexedDB';
import { embeddingsAPI } from '../../api/embeddings';

interface SearchResult extends StoredEmbedding {
  similarity: number;
}

interface EmbeddingSearchProps {
  onSearchResults: (results: SearchResult[]) => void;
}

const EmbeddingSearch: React.FC<EmbeddingSearchProps> = ({ onSearchResults }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModel, setSelectedModel] = useState('all-MiniLM-L6-v2');
  const [threshold, setThreshold] = useState(0.7);
  const [limit, setLimit] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    marginBottom: '20px'
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 15px 0',
    color: '#333',
    fontSize: '18px',
    fontWeight: 'bold'
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  };

  const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555'
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit'
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical'
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    minWidth: '200px'
  };

  const rangeStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '5px'
  };

  const controlsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    flexWrap: 'wrap'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '120px'
  };

  const buttonDisabledStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  };

  const errorStyle: React.CSSProperties = {
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const thresholdLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#666',
    marginTop: '2px'
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Generate embedding for the query
      const response = await embeddingsAPI.embed({
        input: query,
        model: selectedModel
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding generated for query');
      }

      const queryEmbedding = response.data[0].embedding;

      // Perform semantic search
      const { embeddingDB } = await import('../../lib/indexedDB');
      const results = await embeddingDB.semanticSearch(queryEmbedding, threshold, limit);

      console.log('Search completed:', {
        query,
        threshold,
        limit,
        resultsCount: results.length,
        results: results.map(r => ({ id: r.id, similarity: r.similarity, text: r.text.substring(0, 50) + '...' }))
      });

      onSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
      onSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSearch();
    }
  };

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>🔍 Semantic Search</h3>
      
      <div style={formStyle}>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Search Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter your search query (e.g., 'I want to install a package')"
            style={textareaStyle}
            disabled={isSearching}
          />
          <div style={{ fontSize: '12px', color: '#666' }}>
            Tip: Press Ctrl+Enter (or Cmd+Enter on Mac) to search
          </div>
        </div>

        <div style={controlsRowStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={selectStyle}
              disabled={isSearching}
            >
              <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2</option>
              <option value="all-mpnet-base-v2">all-mpnet-base-v2</option>
              <option value="paraphrase-MiniLM-L6-v2">paraphrase-MiniLM-L6-v2</option>
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Similarity Threshold</label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={rangeStyle}
              disabled={isSearching}
            />
            <div style={thresholdLabelStyle}>
              {threshold.toFixed(1)} ({(threshold * 100).toFixed(0)}%)
            </div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Max Results</label>
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              style={inputStyle}
              disabled={isSearching}
            />
          </div>
        </div>

        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          style={isSearching || !query.trim() ? buttonDisabledStyle : buttonStyle}
        >
          {isSearching ? '🔍 Searching...' : '🔍 Search'}
        </button>
      </div>
    </div>
  );
};

export default EmbeddingSearch;
