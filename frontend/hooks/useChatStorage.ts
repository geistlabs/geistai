import { useState, useEffect } from 'react';
import { 
  ChatWithMessages,
  createChat, 
  getChat, 
  getChats, 
  addMessage as addMessageToChat,
  deleteChat as deleteChatFromDB,
  getChatTitle
} from '../lib/chatStorage';

// Legacy Message type for backward compatibility with existing useChat hook
export interface LegacyMessage {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

export const useChatStorage = (chatId?: number) => {
  const [currentChat, setCurrentChat] = useState<ChatWithMessages | null>(null);
  const [messages, setMessages] = useState<LegacyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load chat when chatId changes (database is guaranteed to be ready at app level)
  useEffect(() => {
    const handleChatLoading = async () => {
      if (chatId) {
        await loadChat(chatId);
      } else {
        // No active chat - just clear state
        setMessages([]);
        setCurrentChat(null);
        setIsLoading(false);
      }
    };
    
    handleChatLoading();
  }, [chatId]);

  const loadChat = async (id: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const chat = await getChat(id);
      if (chat) {
        // Get computed title
        const computedTitle = await getChatTitle(id);
        const chatWithComputedTitle = {
          ...chat,
          title: computedTitle
        };
        
        setCurrentChat(chatWithComputedTitle);
        // Convert SQLite messages to legacy format for compatibility
        const legacyMessages: LegacyMessage[] = chat.messages.map(msg => ({
          id: msg.id.toString(),
          text: msg.content,
          role: msg.role,
          timestamp: msg.created_at,
        }));
        setMessages(legacyMessages);
      } else {
        setError('Chat not found');
      }
    } catch (err) {
      console.error('Failed to load chat:', err);
      setError('Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async (): Promise<number> => {
    try {
      const newChatId = await createChat(); // No default title needed
      return newChatId;
    } catch (err) {
      console.error('Failed to create new chat:', err);
      throw err;
    }
  };

  const addMessage = async (message: LegacyMessage, targetChatId?: number): Promise<void> => {
    const effectiveChatId = targetChatId || chatId;
    if (!effectiveChatId) {
      throw new Error('No active chat');
    }

    try {
      // Add message to SQLite
      await addMessageToChat(effectiveChatId, message.role, message.text);
      
      // Update local state only if this is for the current chat (don't reload during streaming to avoid conflicts)
      if (effectiveChatId === chatId) {
        setMessages(prev => [...prev, message]);
      }
      
      // Note: We don't reload the chat here to avoid interfering with streaming
      // The chat title will be updated when the user switches chats or reloads
    } catch (err) {
      console.error('Failed to add message:', err);
      throw err;
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const logChatHistoryForLLM = () => {
    const timestamp = new Date().toISOString();
    
    const formattedHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.text,
      timestamp: new Date(msg.timestamp).toISOString()
    }));
    
    const openAIFormat = messages.map(msg => ({
      role: msg.role,
      content: msg.text
    }));
    
    // Store in global for developer tools access
    (global as any).__CHAT_HISTORY = {
      messages: formattedHistory,
      openAIFormat,
      timestamp,
      messageCount: messages.length
    };
  };

  // Additional functions for ChatDrawer integration
  const getAllChats = async (options: { includeArchived?: boolean } = {}) => {
    return await getChats(options);
  };

  const deleteChat = async (chatId: number) => {
    await deleteChatFromDB(chatId);
    // If we're deleting the current chat, clear the current chat
    if (chatId === currentChat?.id) {
      setMessages([]);
      setCurrentChat(null);
    }
  };

  return {
    messages,
    currentChat,
    isLoading,
    error,
    addMessage,
    createNewChat,
    clearMessages,
    logChatHistoryForLLM,
    // Chat management functions
    getAllChats,
    deleteChat,
    loadChat,
  };
};