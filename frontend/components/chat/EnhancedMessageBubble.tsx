import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Share, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  EnhancedMessage,
  ToolCallEvent,
  AgentConversation,
  CollectedLink,
} from '../../hooks/useChatWithStorage';
import { CitedText } from '../../lib/citation/CitedText';
import { renderMarkdown } from '../../lib/utils/markdownRenderer';

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

interface EnhancedMessageBubbleProps {
  message: EnhancedMessage;
  allMessages?: EnhancedMessage[];
  messageIndex?: number;
}

// Enhanced text component that handles markdown and citations
const EnhancedTextRenderer: React.FC<{ text: string; isUser: boolean }> = ({
  text,
  isUser,
}) => {
  // Check for HTML/XML-like tags (complete or incomplete)
  // Match: <word or <citation or </ (tag-like patterns)
  // Don't match: standalone < in comparisons (< followed by space or number)
  const hasTagLikeContent = /<(?=\/?[a-zA-Z])/.test(text);

  // If text has any tag-like content, use CitedText to handle cleaning
  // CitedText will clean incomplete tags and render complete citations
  if (hasTagLikeContent) {
    return <CitedText text={text} />;
  }

  // Otherwise, use shared markdown renderer
  return renderMarkdown(text);
};

// Tool Call Event Component
const ToolCallEventComponent: React.FC<{ event: ToolCallEvent }> = ({
  event,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#3b82f6';
      case 'completed':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '🔧';
    }
  };

  return (
    <View
      style={{
        backgroundColor: '#f9fafb',
        padding: 8,
        borderRadius: 6,
        marginVertical: 2,
        borderLeftWidth: 3,
        borderLeftColor: getStatusColor(event.status),
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
      >
        <Text style={{ fontSize: 12, marginRight: 6 }}>
          {getStatusIcon(event.status)}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
          {event.toolName}
        </Text>
        <Text style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>
          {event.status}
        </Text>
      </View>
      {event.arguments && (
        <Text style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
          Args: {JSON.stringify(event.arguments).slice(0, 100)}...
        </Text>
      )}
      {event.result && (
        <Text style={{ fontSize: 10, color: '#059669' }}>
          Result: {JSON.stringify(event.result).slice(0, 100)}...
        </Text>
      )}
      {event.error && (
        <Text style={{ fontSize: 10, color: '#dc2626' }}>
          Error: {event.error}
        </Text>
      )}
    </View>
  );
};

// Agent Conversation Component
const AgentConversationComponent: React.FC<{
  conversation: AgentConversation;
}> = ({ conversation }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View
      style={{
        backgroundColor: '#f3f4f6',
        padding: 8,
        borderRadius: 6,
        marginVertical: 2,
      }}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
          🤖 {conversation.agent}
        </Text>
        <Text style={{ fontSize: 10, color: '#6b7280', marginLeft: 8 }}>
          {conversation.type}
        </Text>
        <Text style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {conversation.task && (
        <Text style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
          Task: {conversation.task}
        </Text>
      )}

      {isExpanded &&
        conversation.messages &&
        conversation.messages.length > 0 && (
          <View style={{ marginTop: 4 }}>
            {conversation.messages.map((msg, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: '#ffffff',
                  padding: 6,
                  borderRadius: 4,
                  marginVertical: 2,
                }}
              >
                <EnhancedTextRenderer text={msg.content} isUser={false} />
              </View>
            ))}
          </View>
        )}
    </View>
  );
};

// Collected Links Component
const CollectedLinksComponent: React.FC<{ links: CollectedLink[] }> = ({
  links,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!links || links.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: '#fef3c7',
        padding: 8,
        borderRadius: 6,
        marginTop: 8,
      }}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400e' }}>
          🔗 Sources ({links.length})
        </Text>
        <Text style={{ fontSize: 10, color: '#92400e', marginLeft: 'auto' }}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <ScrollView style={{ maxHeight: 200 }}>
          {links.map((link, index) => (
            <TouchableOpacity
              key={index}
              style={{
                backgroundColor: '#ffffff',
                padding: 6,
                borderRadius: 4,
                marginVertical: 2,
                borderLeftWidth: 2,
                borderLeftColor: '#f59e0b',
              }}
            >
              <Text
                style={{ fontSize: 10, fontWeight: '600', color: '#92400e' }}
              >
                {link.title || link.source || 'Untitled'}
              </Text>
              <Text style={{ fontSize: 9, color: '#6b7280' }} numberOfLines={1}>
                {link.url}
              </Text>
              {link.snippet && (
                <Text
                  style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}
                  numberOfLines={2}
                >
                  {link.snippet}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({
  message,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.isStreaming;

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Failed to copy
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: message.content,
      });
    } catch {
      // Failed to share
    }
  };

  const formatTime = (timestamp: Date | number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View
      style={{
        marginVertical: 4,
        marginHorizontal: 16,
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={{
          maxWidth: '85%',
          backgroundColor: isUser ? '#3b82f6' : '#f3f4f6',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          position: 'relative',
        }}
      >
        {/* Message Content */}
        <View style={{ marginBottom: 8 }}>
          <EnhancedTextRenderer text={message.content} isUser={isUser} />
          {isStreaming && (
            <View style={{ marginTop: 8 }}>
              <LoadingIndicator size='small' />
            </View>
          )}
        </View>

        {/* Timestamp */}
        {message.timestamp && (
          <Text
            style={{
              fontSize: 11,
              color: isUser ? '#93c5fd' : '#6b7280',
              textAlign: isUser ? 'right' : 'left',
              marginTop: 4,
            }}
          >
            {formatTime(message.timestamp)}
          </Text>
        )}

        {/* Action Buttons for Assistant Messages */}
        {isAssistant && !isStreaming && (
          <View
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              flexDirection: 'row',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <TouchableOpacity
              onPress={handleCopy}
              style={{
                padding: 8,
                borderTopLeftRadius: 16,
                borderBottomLeftRadius: 16,
                backgroundColor: copied ? '#10b981' : '#ffffff',
              }}
            >
              {copied ? (
                <CheckIcon color='#ffffff' size={14} />
              ) : (
                <CopyIcon color='#6b7280' size={14} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              style={{
                padding: 8,
                borderTopRightRadius: 16,
                borderBottomRightRadius: 16,
                backgroundColor: '#ffffff',
              }}
            >
              <ShareIcon color='#6b7280' size={14} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Enhanced Features for Assistant Messages */}
      {isAssistant && (
        <View style={{ width: '85%', marginTop: 8 }}>
          {/* Tool Call Events */}
          {message.toolCallEvents && message.toolCallEvents.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 4,
                }}
              >
                🔧 Tool Activity
              </Text>
              {message.toolCallEvents.map((event, index) => (
                <ToolCallEventComponent key={index} event={event} />
              ))}
            </View>
          )}

          {/* Agent Conversations */}
          {message.agentConversations &&
            message.agentConversations.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: 4,
                  }}
                >
                  🤖 Agent Activity
                </Text>
                {message.agentConversations.map((conversation, index) => (
                  <AgentConversationComponent
                    key={index}
                    conversation={conversation}
                  />
                ))}
              </View>
            )}

          {/* Collected Links */}
          {message.collectedLinks && message.collectedLinks.length > 0 && (
            <CollectedLinksComponent links={message.collectedLinks} />
          )}
        </View>
      )}
    </View>
  );
};
