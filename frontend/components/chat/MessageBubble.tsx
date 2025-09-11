import React from 'react';
import { View, Text } from "react-native";

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant" | "system";
    content: string;
    text?: string; // Support both content and text fields
    timestamp?: Date | number;
  };
}

// Simple markdown text component that handles basic formatting without spacing issues
const SimpleMarkdownText: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  const baseStyle = {
    color: isUser ? '#ffffff' : '#111827',
    fontSize: 15,
    lineHeight: 24,
    // fontFamily: 'Geist-Regular',
  };

  // Split text into parts and format basic markdown
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    
    return parts.map((part, index) => {
      // Bold text **text**
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={[baseStyle, { fontWeight: '700' }]}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      // Italic text *text*
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return (
          <Text key={index} style={[baseStyle, { fontStyle: 'italic' }]}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      // Inline code `code`
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Text key={index} style={[baseStyle, { 
            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 14,
          }]}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      // Regular text
      return (
        <Text key={index} style={baseStyle}>
          {part}
        </Text>
      );
    });
  };

  return <Text style={baseStyle}>{renderText(text)}</Text>;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  // Defensive check for undefined message or missing role
  if (!message || !message.role) {
    console.error('MessageBubble received invalid message:', message);
    return null;
  }
  
  const isUser = message.role === "user";
  const messageText = message.content || message.text || '';
  
  // Show a typing indicator for empty assistant messages
  const showTypingIndicator = message.role === "assistant" && !messageText.trim();
  
  // Process text to ensure proper line breaks for markdown
  const processMessageText = (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    
    // First, trim all whitespace and normalize line endings
    let processed = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Only add line breaks in very safe, specific cases:
    
    // 1. Add line break after numbered list items that are immediately followed by another number
    // But only if we can be 100% sure it's a list (check for multiple occurrences)
    const numberedListPattern = /^(\d+\.\s+.+)(\d+\.\s+)/gm;
    if (numberedListPattern.test(text)) {
      processed = processed.replace(/^(\d+\.\s+.+?)(?=^\d+\.\s+)/gm, '$1\n');
    }
    
    // 2. Add line break before markdown headers that start at beginning of line
    processed = processed.replace(/^(#{1,6}\s+)/gm, '\n$1');
    
    // 3. Add line break after sentences that end with period and are followed by capital letter
    // Only if the sentence is longer than 20 chars to avoid abbreviations
    processed = processed.replace(/([.!?]\s+)([A-Z][a-z]{3,})/g, (match, ending, nextWord) => {
      // Find the sentence start to check length
      const beforeMatch = processed.substring(0, processed.indexOf(match));
      const lastSentenceStart = Math.max(
        beforeMatch.lastIndexOf('. '),
        beforeMatch.lastIndexOf('! '),
        beforeMatch.lastIndexOf('? '),
        beforeMatch.lastIndexOf('\n')
      );
      const sentenceLength = beforeMatch.length - lastSentenceStart;
      
      // Only add line break for longer sentences
      if (sentenceLength > 30) {
        return ending + '\n' + nextWord;
      }
      return match;
    });
    
    // 4. Clean up excessive line breaks (more than 2 consecutive)
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    return processed.trim();
  };
  
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
        {showTypingIndicator ? (
          <View className="flex-row items-center space-x-1">
            <View className="w-2 h-2 bg-gray-500 rounded-full" />
            <View className="w-2 h-2 bg-gray-500 rounded-full mx-1" />
            <View className="w-2 h-2 bg-gray-500 rounded-full" />
          </View>
        ) : (
          <SimpleMarkdownText 
            text={processMessageText(messageText)}
            isUser={isUser}
          />
        )}
      </View>
    </View>
  );
}