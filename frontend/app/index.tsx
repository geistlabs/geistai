import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform, FlatList, TouchableOpacity, Alert } from "react-native";
import { useRef, useEffect, useState } from "react";
import { MessageBubble } from "../components/chat/MessageBubble";
import { InputBar } from "../components/chat/InputBar";
import { NetworkStatus } from "../components/NetworkStatus";
import { useChat } from "../hooks/useChat";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import '../global.css';

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const [input, setInput] = useState('');
  
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    retryLastMessage
  } = useChat();

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
  }, [error]);

  const handleSend = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection');
      return;
    }
    if (!input.trim() || isStreaming) return;
    
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleInterrupt = () => {
    stopStreaming();
  };

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
            {/* Center - Title */}
            <View className="flex-row items-center">
              <Text className="text-lg font-medium text-black">Geist</Text>
            </View>
            
            {/* Right side - New Chat Button */}
            <View className="ml-auto">
              <TouchableOpacity 
                onPress={clearMessages} 
                className="px-3 py-1.5 bg-gray-100 rounded-lg"
              >
                <Text className="text-sm text-gray-700">New Chat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Messages List */}
        <View className="flex-1 pb-2">
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id || item.timestamp?.toString() || Math.random().toString()}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            className="flex-1 bg-white"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
          
          {/* Typing Indicator */}
          {isStreaming && !messages.some(m => m.id === 'streaming') && (
            <View className="px-4 pb-2">
              <View className="flex-row self-start">
                <View className="bg-gray-200 rounded-2xl px-4 py-3">
                  <View className="flex-row items-center space-x-1">
                    <View className="w-2 h-2 bg-gray-500 rounded-full" />
                    <View className="w-2 h-2 bg-gray-500 rounded-full mx-1" />
                    <View className="w-2 h-2 bg-gray-500 rounded-full" />
                  </View>
                </View>
              </View>
            </View>
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
    </SafeAreaView>
  );
}
