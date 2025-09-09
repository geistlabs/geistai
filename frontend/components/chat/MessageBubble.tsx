import { View, Text } from "react-native";

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: Date | number;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  
  const formatTime = () => {
    if (!message.timestamp) return '';
    
    const date = typeof message.timestamp === 'number' 
      ? new Date(message.timestamp)
      : message.timestamp;
      
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

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
        {message.timestamp && (
          <Text 
            className={`text-xs mt-1 ${isUser ? "text-blue-100" : "text-gray-400"}`}
          >
            {formatTime()}
          </Text>
        )}
      </View>
    </View>
  );
}