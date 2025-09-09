import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform, FlatList, TouchableOpacity, Alert } from "react-native";
import { useRef, useEffect, useState } from "react";
import { MessageBubble } from "../components/chat/MessageBubble";
import { InputBar } from "../components/chat/InputBar";
import { ChatDrawer } from "../components/chat/ChatDrawer";
import { NetworkStatus } from "../components/NetworkStatus";
import { useChatWithStorage } from "../hooks/useChatWithStorage";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import '../global.css';

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [input, setInput] = useState('');
  const [currentChatId, setCurrentChatId] = useState<number | undefined>(undefined);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage,
    currentChat,
    createNewChat,
    getAllChats,
    deleteChat,
    storageError
  } = useChatWithStorage({ chatId: currentChatId });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error.message || 'Something went wrong');
    }
    if (storageError) {
      Alert.alert('Storage Error', storageError);
    }
  }, [error, storageError]);

  const handleSend = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection');
      return;
    }
    if (!input.trim() || isStreaming) return;
    
    // If no chat is active, create a new one
    let chatId = currentChatId;
    if (!chatId) {
      try {
        chatId = await createNewChat();
        setCurrentChatId(chatId);
      } catch (err) {
        Alert.alert('Error', 'Failed to create new chat');
        return;
      }
    }
    
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleInterrupt = () => {
    stopStreaming();
  };

  const handleNewChat = async () => {
    try {
      const newChatId = await createNewChat();
      setCurrentChatId(newChatId);
      clearMessages();
      await loadChats(); // Refresh chat list
    } catch (err) {
      Alert.alert('Error', 'Failed to create new chat');
    }
  };

  const handleChatSelect = (chatId: number) => {
    setCurrentChatId(chatId);
  };

  const handleDeleteChat = async (chatId: number) => {
    try {
      await deleteChat(chatId);
      if (chatId === currentChatId) {
        setCurrentChatId(undefined);
        clearMessages();
      }
      await loadChats(); // Refresh chat list
    } catch (err) {
      Alert.alert('Error', 'Failed to delete chat');
    }
  };

  const loadChats = async () => {
    try {
      const allChats = await getAllChats({ includeArchived: false });
      setChats(allChats);
      console.log('Successfully loaded chats:', allChats.length);
    } catch (err) {
      console.error('Failed to load chats:', err);
      // Don't show an alert for database not initialized - that's expected during startup
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes('Database not initialized')) {
        Alert.alert('Error', 'Failed to load chat history');
      }
    }
  };

  // Load chats when storage is initialized and not loading
  useEffect(() => {
    if (!isLoading && !storageError) {
      loadChats();
    }
  }, [isLoading, storageError]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Network Status */}
        {!isConnected && <NetworkStatus isOnline={isConnected} position="top" />}
        
        {/* Header */}
        <View className="relative border-b border-gray-200 px-4 py-3">
          <View className="flex-row items-center">
            {/* Left side - Menu Button */}
            <TouchableOpacity 
              onPress={() => setIsDrawerVisible(true)}
              className="mr-3 p-2"
            >
              <View className="space-y-1">
                <View className="w-4 h-0.5 bg-gray-600" />
                <View className="w-4 h-0.5 bg-gray-600" />
                <View className="w-4 h-0.5 bg-gray-600" />
              </View>
            </TouchableOpacity>
            
            {/* Center - Title */}
            <View className="flex-row items-center">
              <Text className="text-lg font-medium text-black">
                {currentChat?.title || 'Geist'}
              </Text>
            </View>
            
            {/* Right side - New Chat Button */}
            <View className="ml-auto">
              <TouchableOpacity 
                onPress={handleNewChat} 
                className="px-3 py-1.5 bg-gray-100 rounded-lg"
              >
                <Text className="text-sm text-gray-700">New Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Messages List */}
        <View className="flex-1 pb-2">
          {/* Debug logging */}
          {console.log('[ChatScreen] Messages array:', messages.map((m, i) => ({ index: i, message: m, hasRole: !!m?.role })))}
          {isLoading && messages.length === 0 ? (
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-gray-500 text-center">Loading...</Text>
              {storageError && (
                <Text className="text-red-500 text-sm text-center mt-2">{storageError}</Text>
              )}
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages.filter(message => {
                const isValid = message && typeof message === 'object' && message.role && 
                  typeof message.content === 'string'; // Allow empty strings for streaming assistant messages
                if (!isValid) {
                  console.warn('[ChatScreen] Filtering out invalid message:', message);
                }
                return isValid;
              })}
              keyExtractor={(item, index) => {
                try {
                  return item?.id || item?.timestamp?.toString() || `message-${index}`;
                } catch (err) {
                  console.error('[ChatScreen] Error in keyExtractor:', err, item);
                  return `error-${index}`;
                }
              }}
              renderItem={({ item }) => {
                try {
                  return <MessageBubble message={item} />;
                } catch (err) {
                  console.error('[ChatScreen] Error rendering message:', err, item);
                  return null;
                }
              }}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              className="flex-1 bg-white"
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}
          
        </View>
        
        {/* Error with Retry */}
        {error && !isStreaming && (
          <TouchableOpacity 
            onPress={retryLastMessage}
            className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <Text className="text-red-600 text-sm text-center">Failed to send. Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Input Bar */}
        <InputBar 
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          onInterrupt={handleInterrupt}
          disabled={isLoading || !isConnected}
          isStreaming={isStreaming}
        />
      </KeyboardAvoidingView>

      {/* Chat Drawer */}
      <ChatDrawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        onChatSelect={handleChatSelect}
        activeChatId={currentChatId}
        onNewChat={handleNewChat}
        chats={chats}
        onDeleteChat={handleDeleteChat}
      />
    </SafeAreaView>
  );
}
