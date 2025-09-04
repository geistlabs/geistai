import { View, Text, SafeAreaView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { useState, useRef } from "react";
import { MessageBubble } from "../components/chat/MessageBubble";

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
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");

    // Simulate assistant response (we'll connect to API later)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I received your message: " + inputText.trim(),
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

        {/* Input Bar - We'll build this component */}
        <View className="bg-white border-t border-gray-200 px-4 py-3">
          <View className="flex-row items-center space-x-2">
            <TextInput
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-base"
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSend}
              className="bg-blue-500 rounded-full p-3"
              disabled={!inputText.trim()}
            >
              <Text className="text-white font-semibold">Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
