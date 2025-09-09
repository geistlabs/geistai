import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useRef, useEffect } from "react";
import { MessageBubble } from "../components/chat/MessageBubble";
import { InputBar } from "../components/chat/InputBar";
import { NetworkStatus } from "../components/NetworkStatus";
import { useChat } from "../hooks/useChat";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const { isConnected, isInternetReachable } = useNetworkStatus();
  
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

  const handleSend = async (text: string) => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection');
      return;
    }
    await sendMessage(text);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Network Status */}
        <NetworkStatus isOnline={isConnected} position="top" />
        
        {/* Chat Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
          <View className="w-10" />
          <Text className="text-lg font-semibold text-center flex-1">AI Chat</Text>
          <TouchableOpacity onPress={clearMessages} className="w-10">
            <Ionicons name="trash-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || item.timestamp?.toString() || Math.random().toString()}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          className="flex-1 bg-gray-50"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        
        {/* Streaming Indicator */}
        {isStreaming && (
          <View className="flex-row items-center justify-center py-2 px-4 bg-blue-50">
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="ml-2 text-blue-600 text-sm">AI is typing...</Text>
            <TouchableOpacity onPress={stopStreaming} className="ml-4 px-2 py-1 bg-red-500 rounded">
              <Text className="text-white text-xs">Stop</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Error with Retry */}
        {error && !isStreaming && (
          <TouchableOpacity 
            onPress={retryLastMessage}
            className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex-row items-center"
          >
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <Text className="ml-2 text-red-600 text-sm flex-1">Failed to send. Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Input Bar */}
        <InputBar onSend={handleSend} disabled={isLoading || isStreaming || !isConnected} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
