import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import ChatEmbeddings from '../components/embeddings/ChatEmbeddings';

const ChatPage: React.FC = () => {
  const [chatId, setChatId] = useState<string | null>(null);

  // Get the chat ID from the ChatInterface component
  useEffect(() => {
    // We'll need to pass the chat ID from ChatInterface
    // For now, we'll generate one here and pass it down
    const newChatId = crypto.randomUUID();
    setChatId(newChatId);
  }, []);

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  };

  const chatContainerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  };

  const embeddingsContainerStyle: React.CSSProperties = {
    maxHeight: '200px',
    overflowY: 'auto',
    borderTop: '1px solid #ccc',
    backgroundColor: '#f8f9fa'
  };

  return (
    <div style={pageStyle}>
      <div style={chatContainerStyle}>
        <ChatInterface chatId={chatId || undefined} />
      </div>
      {chatId && (
        <div style={embeddingsContainerStyle}>
          <ChatEmbeddings chatId={chatId} />
        </div>
      )}
    </div>
  );
};

export default ChatPage;
