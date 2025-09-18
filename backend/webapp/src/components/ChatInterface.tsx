import React, { useState, useEffect } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { sendMessage, sendStreamingMessage, ChatMessage } from '../api/chat'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  isStreaming?: boolean // Indicates if this message is currently being streamed
}

interface ChatInterfaceProps {
  chatId?: string; // Optional chat ID prop
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatId: propChatId }) => {
  const [chatId] = useState(() => propChatId || crypto.randomUUID()) // Use prop or generate unique chat ID
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! This is a basic chat interface for testing the GeistAI router. Type a message to get started.',
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  const [isLoading, setIsLoading] = useState(false)

  // Function to create embedding for a message
  const createMessageEmbedding = async (message: Message) => {
    try {
      const { embeddingsAPI } = await import('../api/embeddings');
      const { embeddingDB } = await import('../lib/indexedDB');
      
      const response = await embeddingsAPI.embed({
        input: message.content,
        model: 'all-MiniLM-L6-v2'
      });
      
      if (response.data.length > 0) {
        const embeddingData = response.data[0];
        
        await embeddingDB.saveEmbedding({
          text: message.content,
          embedding: embeddingData.embedding,
          model: response.model,
          chatId: chatId,
          messageId: message.id,
          metadata: {
            role: message.role,
            timestamp: message.timestamp.toISOString(),
            usage: response.usage
          }
        });
      }
    } catch (error) {
      console.error('Failed to create embedding for message:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Create embedding for user message
    createMessageEmbedding(userMessage);

    // Create streaming assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: true
    }

    setMessages(prev => [...prev, assistantMessage])

    // Convert messages to ChatMessage format for API
    const conversationHistory: ChatMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      await sendStreamingMessage(
        content.trim(),
        conversationHistory,
        // onToken callback
        (token: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: msg.content + token }
              : msg
          ));
        },
        // onComplete callback
        () => {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, isStreaming: false }
              : msg
          ));
          setIsLoading(false);
          
          // Create embedding for completed assistant message
          const completedMessage = messages.find(m => m.id === assistantMessageId);
          if (completedMessage) {
            createMessageEmbedding({ ...completedMessage, isStreaming: false });
          }
        },
        // onError callback
        (error: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  content: `Error: ${error}`,
                  isStreaming: false 
                }
              : msg
          ));
          setIsLoading(false);
          
          // Create embedding for error message
          const errorMessage = { 
            id: assistantMessageId,
            content: `Error: ${error}`,
            role: 'assistant' as const,
            timestamp: new Date(),
            isStreaming: false
          };
          createMessageEmbedding(errorMessage);
        }
      );
    } catch (error) {
      console.error('Error in streaming chat:', error)
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
              isStreaming: false 
            }
          : msg
      ));
      setIsLoading(false);
      
      // Create embedding for error message
      const errorMessage = { 
        id: assistantMessageId,
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        role: 'assistant' as const,
        timestamp: new Date(),
        isStreaming: false
      };
      createMessageEmbedding(errorMessage);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'white'
    }}>
      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput onSendMessage={handleSendMessage} disabled={isLoading} />
    </div>
  )
}

export default ChatInterface
