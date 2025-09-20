import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Share } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LoadingIndicator } from './LoadingIndicator';

const CopyIcon = ({ color = 'currentColor', size = 16 }) => (
  <Svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke={color}
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <Path d='M15 2a2 2 0 0 1 1.414.586l4 4A2 2 0 0 1 21 8v7a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z' />
    <Path d='M15 2v4a2 2 0 0 0 2 2h4' />
    <Path d='M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1' />
  </Svg>
);

const ShareIcon = ({ color = 'currentColor', size = 16 }) => (
  <Svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke={color}
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <Path d='M12 2v13' />
    <Path d='m16 6-4-4-4 4' />
    <Path d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' />
  </Svg>
);

const CheckIcon = ({ color = 'currentColor', size = 16 }) => (
  <Svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke={color}
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <Path d='M20 6 9 17l-5-5' />
  </Svg>
);

interface MessageBubbleProps {
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    text?: string; // Support both content and text fields
    timestamp?: Date | number;
  };
  allMessages?: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    text?: string;
    timestamp?: Date | number;
  }[];
  messageIndex?: number;
}

// Simple markdown text component that handles basic formatting without spacing issues
const SimpleMarkdownText: React.FC<{ text: string; isUser: boolean }> = ({
  text,
  isUser,
}) => {
  const baseStyle = {
    color: '#111827', // Both user and AI messages use black text
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
      if (
        part.startsWith('*') &&
        part.endsWith('*') &&
        !part.startsWith('**')
      ) {
        return (
          <Text key={index} style={[baseStyle, { fontStyle: 'italic' }]}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      // Inline code `code`
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Text
            key={index}
            style={[
              baseStyle,
              {
                backgroundColor: '#f3f4f6', // Same background for both user and AI
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 14,
              },
            ]}
          >
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

export function MessageBubble({
  message,
  allMessages = [],
  messageIndex,
}: MessageBubbleProps) {
  const [isCopied, setIsCopied] = useState(false);

  // Defensive check for undefined message or missing role
  if (!message || !message.role) {
    console.error('MessageBubble received invalid message:', message);
    return null;
  }

  const isUser = message.role === 'user';
  const messageText = message.content || message.text || '';

  // Show a typing indicator for empty assistant messages
  const showTypingIndicator =
    message.role === 'assistant' && !messageText.trim();

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(messageText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleShare = async () => {
    try {
      // Find the user question that corresponds to this assistant answer
      let shareText = messageText;

      if (
        message.role === 'assistant' &&
        allMessages &&
        messageIndex !== undefined &&
        messageIndex > 0
      ) {
        // Look for the previous user message
        const userMessage = allMessages[messageIndex - 1];
        if (userMessage && userMessage.role === 'user') {
          const userText = userMessage.content || userMessage.text || '';
          shareText = `Q: ${userText}\n\nA: ${messageText}`;
        }
      }

      await Share.share({
        message: shareText,
        title: 'Chat Message',
      });
    } catch (error) {
      console.error('Failed to share text:', error);
      // Fallback to clipboard if sharing fails
      try {
        await Clipboard.setStringAsync(shareText);
        Alert.alert('Shared', 'Content copied to clipboard');
      } catch (clipboardError) {
        console.error('Failed to copy to clipboard:', clipboardError);
      }
    }
  };

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
    processed = processed.replace(
      /([.!?]\s+)([A-Z][a-z]{3,})/g,
      (match, ending, nextWord) => {
        // Find the sentence start to check length
        const beforeMatch = processed.substring(0, processed.indexOf(match));
        const lastSentenceStart = Math.max(
          beforeMatch.lastIndexOf('. '),
          beforeMatch.lastIndexOf('! '),
          beforeMatch.lastIndexOf('? '),
          beforeMatch.lastIndexOf('\n'),
        );
        const sentenceLength = beforeMatch.length - lastSentenceStart;

        // Only add line break for longer sentences
        if (sentenceLength > 30) {
          return ending + '\n' + nextWord;
        }
        return match;
      },
    );

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
        isUser ? 'bg-gray-200 self-end' : 'self-start'
      }`}
    >
      <View>
        <View
          style={{
            paddingTop: 10,
            paddingLeft: 12,
            paddingRight: 12,
            paddingBottom: 6,
          }}
        >
          {showTypingIndicator ? (
            <LoadingIndicator size='small' />
          ) : (
            <SimpleMarkdownText
              text={processMessageText(messageText)}
              isUser={isUser}
            />
          )}
        </View>
        {!showTypingIndicator && messageText.trim() && !isUser && (
          <View
            style={{
              paddingLeft: 12,
              paddingBottom: 8,
              paddingRight: 12,
              marginTop: -2,
            }}
            className='flex-row items-center space-x-3'
          >
            <TouchableOpacity onPress={handleCopy}>
              {isCopied ? (
                <CheckIcon color='#6B7280' size={14} />
              ) : (
                <CopyIcon color='#6B7280' size={14} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare}>
              <ShareIcon color='#6B7280' size={14} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
