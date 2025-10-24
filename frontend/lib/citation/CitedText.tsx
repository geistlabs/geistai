import * as WebBrowser from 'expo-web-browser';
import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  Modal,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
} from 'react-native';

// import { renderMarkdown } from '../utils/markdownRenderer';

import { Citation } from './citationParser';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.45;

interface CitedTextProps {
  text: string;
  agentName?: string;
  textStyle?: string;
  linkStyle?: string;
}

/**
 * Extract domain name from URL
 */
function getDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'source';
  }
}

/**
 * Component that renders text with citations as clickable links with tooltips
 */
export const CitedText: React.FC<CitedTextProps> = ({
  text,
  agentName,
  textStyle,
  linkStyle,
}) => {
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(
    null,
  );
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedCitation) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SCREEN_HEIGHT - DRAWER_HEIGHT,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selectedCitation, slideAnim, opacityAnim]);

  const handleClose = () => {
    setSelectedCitation(null);
  };

  // Clean up incomplete tags while preserving code blocks and complete citations
  // Step 1: Temporarily replace code blocks (inline and fenced) with placeholders
  const codePlaceholders: string[] = [];
  const textWithCodePlaceholders = text.replace(/(`+)([^`]+)\1/g, match => {
    const placeholder = `__CODE_${codePlaceholders.length}__`;
    codePlaceholders.push(match);
    return placeholder;
  });

  // Step 2: Temporarily replace complete citations with placeholders
  const citationPlaceholders: string[] = [];
  let textWithPlaceholders = textWithCodePlaceholders.replace(
    /<citation([^>]*)\s*\/>/g,
    match => {
      const placeholder = `__CITATION_${citationPlaceholders.length}__`;
      citationPlaceholders.push(match);
      return placeholder;
    },
  );

  // Step 3: Remove any remaining incomplete/malformed tags
  // This catches: <citation, <div, <something, etc. but NOT legitimate < in text
  textWithPlaceholders = textWithPlaceholders
    // Remove incomplete tag starts: < followed by letters (tag-like) but not properly closed
    .replace(/<\/?[a-zA-Z][^>]*/g, '')
    // Remove any stray > characters that might be left
    .replace(/>/g, '');

  // Step 4: Restore code blocks
  const textWithCodeRestored = textWithPlaceholders.replace(
    /__CODE_(\d+)__/g,
    (_, index) => codePlaceholders[parseInt(index, 10)],
  );

  // Step 5: Restore complete citations
  const cleanedText = textWithCodeRestored.replace(
    /__CITATION_(\d+)__/g,
    (_, index) => citationPlaceholders[parseInt(index, 10)],
  );

  // Split text by citation tags and render
  const parts: {
    type: 'text' | 'citation';
    content: string;
    source?: string;
    url?: string;
    snippet?: string;
  }[] = [];
  let lastIndex = 0;

  // Match only complete self-closing format: <citation source="..." url="..." snippet="..." />
  const citationPattern = /<citation([^>]*)\s*\/>/g;
  let match;

  while ((match = citationPattern.exec(cleanedText)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: cleanedText.substring(lastIndex, match.index),
      });
    }

    // Parse attributes from the citation tag
    const attributes = match[1];

    // Extract source, url, and snippet from attributes
    const sourceMatch = /source=["']([^"']*)["']/.exec(attributes);
    const urlMatch = /url=["']([^"']*)["']/.exec(attributes);
    const snippetMatch = /snippet=["']([^"']*)["']/.exec(attributes);

    const source = sourceMatch?.[1];
    const url = urlMatch?.[1];
    const snippet = snippetMatch?.[1];

    // Only add citation if it has at least a source or URL (valid citation)
    if (source || url) {
      parts.push({
        type: 'citation',
        content: match[0],
        source,
        url,
        snippet,
      });
    } else {
      // Invalid citation - treat as text (but we'll just skip it)
      continue;
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < cleanedText.length) {
    parts.push({
      type: 'text',
      content: cleanedText.substring(lastIndex),
    });
  }

  return (
    <>
      <View>
        {parts.map((part, index) => {
          if (part.type === 'text') {
            // Check if this is just whitespace
            if (part.content.trim() === '') {
              return null;
            }

            // Temporarily use plain text instead of markdown for debugging
            return (
              <View key={index}>
                <Text
                  style={{ color: '#111827', fontSize: 15, lineHeight: 22 }}
                >
                  {part.content}
                </Text>
              </View>
            );
          }

          // Validate citation has required data
          if (!part.source && !part.url) {
            // Invalid citation - skip rendering
            return null;
          }

          // Create citation object from inline attributes
          const citation: Citation = {
            number: undefined,
            source: part.source || '',
            url: part.url,
            snippet: part.snippet,
          };

          // Determine display text
          const displayText = citation.url
            ? getDomainName(citation.url)
            : citation.source || 'source';

          // Render as a cute bubble pill
          return (
            <TouchableOpacity
              key={index}
              onPress={() => setSelectedCitation(citation)}
              activeOpacity={0.7}
              style={{
                alignSelf: 'flex-start',
                marginVertical: 4,
              }}
            >
              <View
                style={{
                  backgroundColor: '#dbeafe',
                  borderRadius: 10,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  marginHorizontal: 3,
                  borderWidth: 1,
                  borderColor: '#93c5fd',
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: '#1e40af',
                    fontWeight: '600',
                  }}
                >
                  {displayText}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Citation Drawer */}
      {selectedCitation && (
        <Modal
          visible={true}
          transparent
          animationType='none'
          onRequestClose={handleClose}
          statusBarTranslucent
        >
          <View
            style={{
              flex: 1,
              position: 'relative',
            }}
          >
            {/* Backdrop */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                opacity: opacityAnim,
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={handleClose} />
            </Animated.View>

            {/* Drawer */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: SCREEN_HEIGHT,
                transform: [{ translateY: slideAnim }],
              }}
              pointerEvents='box-none'
            >
              <View
                style={{
                  height: DRAWER_HEIGHT,
                  backgroundColor: 'white',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 20,
                }}
              >
                {/* Drag Handle */}
                <TouchableOpacity
                  onPress={handleClose}
                  activeOpacity={0.7}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      backgroundColor: '#d1d5db',
                      borderRadius: 2,
                    }}
                  />
                </TouchableOpacity>

                {/* Content */}
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={{
                      backgroundColor: '#eff6ff',
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#dbeafe',
                    }}
                  >
                    {/* Source */}
                    {selectedCitation.source && (
                      <View style={{ marginBottom: 16 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#1e3a8a',
                            marginBottom: 6,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Source
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            color: '#111827',
                            fontWeight: '600',
                            lineHeight: 26,
                          }}
                        >
                          {selectedCitation.source}
                        </Text>
                      </View>
                    )}

                    {/* Snippet */}
                    {selectedCitation.snippet && (
                      <View
                        style={{
                          backgroundColor: 'white',
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 16,
                          borderWidth: 1,
                          borderColor: '#e0e7ff',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#1e3a8a',
                            marginBottom: 8,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Excerpt
                        </Text>
                        <Text
                          style={{
                            fontSize: 15,
                            color: '#374151',
                            lineHeight: 22,
                          }}
                        >
                          {'\u201C'}
                          {selectedCitation.snippet}
                          {'\u201D'}
                        </Text>
                      </View>
                    )}

                    {/* URL */}
                    {selectedCitation.url && (
                      <View style={{ marginBottom: 12 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#1e3a8a',
                            marginBottom: 6,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Link
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.6}
                          onPress={() => {
                            WebBrowser.openBrowserAsync(selectedCitation.url!);
                          }}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 4,
                            marginHorizontal: -4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: '#2563eb',
                              textDecorationLine: 'underline',
                            }}
                            numberOfLines={3}
                          >
                            {selectedCitation.url}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Confidence */}
                    {selectedCitation.confidence !== undefined && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginTop: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#1e3a8a',
                            marginRight: 8,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Confidence
                        </Text>
                        <View
                          style={{
                            backgroundColor: '#3b82f6',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: 'white',
                              fontWeight: '600',
                            }}
                          >
                            {(
                              Math.round(selectedCitation.confidence * 1000) /
                              10
                            ).toFixed(1)}
                            %
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
};
