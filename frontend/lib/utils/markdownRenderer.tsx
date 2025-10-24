import React from 'react';
import Markdown from 'react-native-markdown-display';

/**
 * Custom markdown styles matching our app's design
 */
const markdownStyles = {
  body: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 24,
  },
  text: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 24,
  },
  strong: {
    fontWeight: '700' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  code_inline: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace' as const,
    fontSize: 14,
    color: '#111827',
  },
  code_block: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'monospace' as const,
    fontSize: 14,
    color: '#111827',
  },
  fence: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
    fontFamily: 'monospace' as const,
    fontSize: 14,
    color: '#111827',
  },
};

/**
 * Renders text with markdown formatting support using react-native-markdown-display
 * Supports: **bold**, *italic*, `code`, and more
 */
export const MarkdownText: React.FC<{ children: string }> = ({ children }) => {
  return <Markdown style={markdownStyles}>{children}</Markdown>;
};

/**
 * Legacy function for backward compatibility
 * Now returns a Markdown component
 */
export const renderMarkdown = (text: string) => {
  return <MarkdownText key={text}>{text}</MarkdownText>;
};
