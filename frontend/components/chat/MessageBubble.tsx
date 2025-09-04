import { View, Text } from "react-native";

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View className={`flex-row ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <View
        className={`
          max-w-[80%] px-4 py-3 rounded-2xl
          ${isUser 
            ? "bg-blue-500 rounded-br-sm" 
            : "bg-white border border-gray-200 rounded-bl-sm"
          }
        `}
      >
        <Text 
          className={`text-base ${isUser ? "text-white" : "text-gray-800"}`}
        >
          {message.content}
        </Text>
        
        {/* Timestamp */}
        <Text 
          className={`text-xs mt-1 ${isUser ? "text-blue-100" : "text-gray-400"}`}
        >
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    </View>
  );
}