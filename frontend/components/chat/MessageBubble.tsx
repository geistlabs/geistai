import { View, Text } from "react-native";

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant" | "system";
    content: string;
    text?: string; // Support both content and text fields
    timestamp?: Date | number;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const messageText = message.content || message.text || '';
  
  return (
    <View
      style={{
        marginBottom: 16,
        marginTop: 8,
      }}
      className={`max-w-[80%] rounded-2xl ${
        isUser 
          ? 'bg-blue-600 self-end' 
          : 'bg-gray-200 self-start'
      }`}>
      <View style={{ 
        paddingTop: 12, 
        paddingLeft: 12, 
        paddingRight: 12, 
        paddingBottom: 12,
      }}>
        <Text 
          style={{
            color: isUser ? '#ffffff' : '#111827',
            fontSize: 15,
            lineHeight: 24,
          }}
        >
          {messageText}
        </Text>
      </View>
    </View>
  );
}