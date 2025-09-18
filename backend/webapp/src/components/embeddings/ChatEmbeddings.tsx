import React, { useState, useEffect } from 'react';
import { StoredEmbedding, embeddingDB } from '../../lib/indexedDB';

interface ChatEmbeddingsProps {
  chatId: string;
}

const ChatEmbeddings: React.FC<ChatEmbeddingsProps> = ({ chatId }) => {
  const [embeddings, setEmbeddings] = useState<StoredEmbedding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChatEmbeddings();
  }, [chatId]);

  const loadChatEmbeddings = async () => {
    try {
      const chatEmbeddings = await embeddingDB.getEmbeddingsByChatId(chatId);
      setEmbeddings(chatEmbeddings);
    } catch (error) {
      console.error('Failed to load chat embeddings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    backgroundColor: '#f8f9fa',
    marginBottom: '15px'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '10px'
  };

  const embeddingItemStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#666',
    padding: '5px 0',
    borderBottom: '1px solid #eee'
  };

  const roleStyle: React.CSSProperties = {
    fontWeight: 'bold',
    marginRight: '8px'
  };

  const userRoleStyle: React.CSSProperties = {
    ...roleStyle,
    color: '#007bff'
  };

  const assistantRoleStyle: React.CSSProperties = {
    ...roleStyle,
    color: '#28a745'
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Loading chat embeddings...</div>
      </div>
    );
  }

  if (embeddings.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Chat Embeddings (0)</div>
        <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
          No embeddings found for this chat yet.
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        Chat Embeddings ({embeddings.length})
      </div>
      {embeddings.map(embedding => (
        <div key={embedding.id} style={embeddingItemStyle}>
          <span style={embedding.metadata?.role === 'user' ? userRoleStyle : assistantRoleStyle}>
            {embedding.metadata?.role || 'Unknown'}:
          </span>
          <span>{embedding.text.substring(0, 100)}{embedding.text.length > 100 ? '...' : ''}</span>
        </div>
      ))}
    </div>
  );
};

export default ChatEmbeddings;
