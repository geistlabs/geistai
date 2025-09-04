import { View, Text, SafeAreaView, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { useState, useRef } from "react";
import { MessageBubble } from "../components/chat/MessageBubble";
import { InputBar } from "../components/chat/InputBar";

// Type definitions for our messages
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate assistant response (we'll connect to API later)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I received your message: " + text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Auto-scroll to bottom
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 1000);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Chat Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3">
          <Text className="text-lg font-semibold text-center">AI Chat</Text>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          className="flex-1 bg-gray-50"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Bar */}
        <InputBar onSend={handleSend} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
