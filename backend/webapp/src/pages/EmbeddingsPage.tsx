import React, { useState, useEffect } from 'react';
import EmbeddingCreator from '../components/embeddings/EmbeddingCreator';
import EmbeddingExplorer from '../components/embeddings/EmbeddingExplorer';
import { StoredEmbedding } from '../lib/indexedDB';
import { embeddingsAPI } from '../api/embeddings';

const EmbeddingsPage: React.FC = () => {
  const [embeddings, setEmbeddings] = useState<StoredEmbedding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    loadEmbeddings();
    checkApiStatus();
  }, []);

  const loadEmbeddings = async () => {
    try {
      const { embeddingDB } = await import('../lib/indexedDB');
      const storedEmbeddings = await embeddingDB.getAllEmbeddings();
      setEmbeddings(storedEmbeddings);
    } catch (error) {
      console.error('Failed to load embeddings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkApiStatus = async () => {
    try {
      await embeddingsAPI.healthCheck();
      setApiStatus('online');
    } catch (error) {
      setApiStatus('offline');
    }
  };

  const handleEmbeddingCreated = (embedding: StoredEmbedding) => {
    setEmbeddings(prev => [embedding, ...prev]);
  };

  const handleEmbeddingDeleted = (id: string) => {
    setEmbeddings(prev => prev.filter(e => e.id !== id));
  };

  const pageStyle: React.CSSProperties = {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const statusStyle: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '20px',
    fontSize: '14px',
    fontWeight: 'bold'
  };

  const onlineStatusStyle: React.CSSProperties = {
    ...statusStyle,
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb'
  };

  const offlineStatusStyle: React.CSSProperties = {
    ...statusStyle,
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb'
  };

  const checkingStatusStyle: React.CSSProperties = {
    ...statusStyle,
    backgroundColor: '#fff3cd',
    color: '#856404',
    border: '1px solid #ffeaa7'
  };

  const getStatusStyle = () => {
    switch (apiStatus) {
      case 'online':
        return onlineStatusStyle;
      case 'offline':
        return offlineStatusStyle;
      case 'checking':
        return checkingStatusStyle;
    }
  };

  const getStatusText = () => {
    switch (apiStatus) {
      case 'online':
        return '✅ Embeddings API is online';
      case 'offline':
        return '❌ Embeddings API is offline - check your backend service';
      case 'checking':
        return '🔄 Checking API status...';
    }
  };

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          Loading embeddings...
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: '0 0 20px 0', color: '#333' }}>
        Embeddings Management
      </h1>
      
      <div style={getStatusStyle()}>
        {getStatusText()}
      </div>

      <EmbeddingCreator onEmbeddingCreated={handleEmbeddingCreated} />
      
      <EmbeddingExplorer 
        embeddings={embeddings}
        onEmbeddingDeleted={handleEmbeddingDeleted}
      />
    </div>
  );
};

export default EmbeddingsPage;
