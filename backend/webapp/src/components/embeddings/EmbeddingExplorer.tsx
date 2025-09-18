import React, { useState, useEffect } from 'react';
import { StoredEmbedding } from '../../lib/indexedDB';

interface EmbeddingExplorerProps {
  embeddings: StoredEmbedding[];
  onEmbeddingDeleted: (id: string) => void;
}

const EmbeddingExplorer: React.FC<EmbeddingExplorerProps> = ({ 
  embeddings, 
  onEmbeddingDeleted 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedChatId, setSelectedChatId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'text'>('newest');

  const filteredEmbeddings = embeddings
    .filter(embedding => {
      const matchesSearch = embedding.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModel = selectedModel === 'all' || embedding.model === selectedModel;
      const matchesChat = selectedChatId === 'all' || embedding.chatId === selectedChatId;
      return matchesSearch && matchesModel && matchesChat;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'text':
          return a.text.localeCompare(b.text);
        default:
          return 0;
      }
    });

  const uniqueModels = Array.from(new Set(embeddings.map(e => e.model)));
  const uniqueChatIds = Array.from(new Set(embeddings.map(e => e.chatId).filter(Boolean)));

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9'
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center'
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    minWidth: '120px'
  };

  const embeddingItemStyle: React.CSSProperties = {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '10px',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const textStyle: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: '1.4',
    marginBottom: '10px',
    color: '#333'
  };

  const metadataStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#666',
    display: 'flex',
    gap: '15px',
    marginBottom: '10px'
  };

  const embeddingInfoStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace'
  };

  const deleteButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: '40px'
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this embedding?')) {
      try {
        await import('../../lib/indexedDB').then(({ embeddingDB }) => 
          embeddingDB.deleteEmbedding(id)
        );
        onEmbeddingDeleted(id);
      } catch (error) {
        console.error('Failed to delete embedding:', error);
        alert('Failed to delete embedding');
      }
    }
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
        Stored Embeddings ({filteredEmbeddings.length})
      </h3>

      <div style={controlsStyle}>
        <input
          type="text"
          placeholder="Search embeddings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={inputStyle}
        />

        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Models</option>
          {uniqueModels.map(model => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>

        <select
          value={selectedChatId}
          onChange={(e) => setSelectedChatId(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Chats</option>
          {uniqueChatIds.map(chatId => (
            <option key={chatId} value={chatId}>
              Chat: {chatId.substring(0, 8)}...
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={selectStyle}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="text">Alphabetical</option>
        </select>
      </div>

      {filteredEmbeddings.length === 0 ? (
        <div style={emptyStateStyle}>
          {embeddings.length === 0 
            ? 'No embeddings stored yet. Create your first embedding above!'
            : 'No embeddings match your search criteria.'
          }
        </div>
      ) : (
        <div>
          {filteredEmbeddings.map(embedding => (
            <div key={embedding.id} style={embeddingItemStyle}>
              <div style={textStyle}>
                {embedding.text}
              </div>
              
              <div style={metadataStyle}>
                <span>Model: {embedding.model}</span>
                <span>Created: {new Date(embedding.createdAt).toLocaleString()}</span>
                <span>Dimensions: {embedding.embedding.length}</span>
                {embedding.chatId && (
                  <span>Chat: {embedding.chatId.substring(0, 8)}...</span>
                )}
                {embedding.metadata?.role && (
                  <span>Role: {embedding.metadata.role}</span>
                )}
              </div>

              <div style={embeddingInfoStyle}>
                Embedding: [{embedding.embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]
                {embedding.embedding.length > 5 && ` (${embedding.embedding.length} total)`}
              </div>

              <button
                onClick={() => handleDelete(embedding.id)}
                style={deleteButtonStyle}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmbeddingExplorer;
