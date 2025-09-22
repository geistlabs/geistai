import React from 'react';
import { StoredEmbedding } from '../../lib/indexedDB';

interface SearchResult extends StoredEmbedding {
  similarity: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  onClearResults: () => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onClearResults }) => {
  console.log('SearchResults component rendered with:', {
    resultsCount: results.length,
    results: results.map(r => ({ id: r.id, similarity: r.similarity, text: r.text.substring(0, 50) + '...' }))
  });

  if (results.length === 0) {
    console.log('SearchResults: No results to display');
    return null;
  }

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    marginBottom: '20px'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  };

  const titleStyle: React.CSSProperties = {
    margin: '0',
    color: '#333',
    fontSize: '18px',
    fontWeight: 'bold'
  };

  const clearButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const resultItemStyle: React.CSSProperties = {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '10px',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    position: 'relative'
  };

  const similarityBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: '#28a745',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  };

  const textStyle: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: '1.4',
    marginBottom: '10px',
    color: '#333',
    marginRight: '80px' // Make room for similarity badge
  };

  const metadataStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#666',
    display: 'flex',
    gap: '15px',
    marginBottom: '10px',
    flexWrap: 'wrap'
  };

  const embeddingInfoStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace'
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: '40px'
  };

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.9) return '#28a745'; // Green
    if (similarity >= 0.8) return '#17a2b8'; // Blue
    if (similarity >= 0.7) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
  };

  const formatSimilarity = (similarity: number): string => {
    return `${(similarity * 100).toFixed(1)}%`;
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          🎯 Search Results ({results.length})
        </h3>
        <button
          onClick={onClearResults}
          style={clearButtonStyle}
        >
          Clear Results
        </button>
      </div>

      {results.length === 0 ? (
        <div style={emptyStateStyle}>
          No results found. Try adjusting your search query or similarity threshold.
        </div>
      ) : (
        <div>
          {results.map((result, index) => (
            <div key={result.id} style={resultItemStyle}>
              <div style={{
                ...similarityBadgeStyle,
                backgroundColor: getSimilarityColor(result.similarity)
              }}>
                {formatSimilarity(result.similarity)}
              </div>
              
              <div style={textStyle}>
                {result.text}
              </div>
              
              <div style={metadataStyle}>
                <span>Model: {result.model}</span>
                <span>Created: {new Date(result.createdAt).toLocaleString()}</span>
                <span>Dimensions: {result.embedding.length}</span>
                {result.chatId && (
                  <span>Chat: {result.chatId.substring(0, 8)}...</span>
                )}
                {result.metadata?.role && (
                  <span>Role: {result.metadata.role}</span>
                )}
              </div>

              <div style={embeddingInfoStyle}>
                Embedding: [{result.embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]
                {result.embedding.length > 5 && ` (${result.embedding.length} total)`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
