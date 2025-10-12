import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { DebugInfo } from '../../lib/api/chat-debug';

interface DebugPanelProps {
  debugInfo: DebugInfo | null;
  isVisible: boolean;
  onToggle: () => void;
}

export function DebugPanel({
  debugInfo,
  isVisible,
  onToggle,
}: DebugPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTokensPerSecond = (tps: number) => {
    return `${tps.toFixed(2)} tok/s`;
  };

  const getRouteColor = (route: string) => {
    switch (route) {
      case 'llama':
        return '#10B981'; // Green
      case 'qwen_tools':
        return '#F59E0B'; // Yellow
      case 'qwen_direct':
        return '#3B82F6'; // Blue
      default:
        return '#6B7280'; // Gray
    }
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        onPress={onToggle}
        style={{
          position: 'absolute',
          top: 50,
          right: 10,
          backgroundColor: '#1F2937',
          padding: 8,
          borderRadius: 20,
          zIndex: 1000,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
          DEBUG
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 50,
        right: 10,
        width: 300,
        maxHeight: '80%',
        backgroundColor: '#1F2937',
        borderRadius: 8,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#374151',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
          🐛 Debug Panel
        </Text>
        <TouchableOpacity
          onPress={onToggle}
          style={{
            backgroundColor: '#374151',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ maxHeight: '80%' }}
        showsVerticalScrollIndicator={false}
      >
        {debugInfo ? (
          <View style={{ padding: 12 }}>
            {/* Performance Section */}
            <TouchableOpacity
              onPress={() => toggleSection('performance')}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#374151',
              }}
            >
              <Text
                style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}
              >
                ⚡ Performance
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                {expandedSections.has('performance') ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedSections.has('performance') && (
              <View style={{ paddingVertical: 8, paddingLeft: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Connection Time:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {formatTime(debugInfo.connectionTime)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    First Token:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {formatTime(debugInfo.firstTokenTime)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Total Time:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {formatTime(debugInfo.totalTime)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Tokens/Second:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {formatTokensPerSecond(debugInfo.tokensPerSecond)}
                  </Text>
                </View>
              </View>
            )}

            {/* Routing Section */}
            <TouchableOpacity
              onPress={() => toggleSection('routing')}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#374151',
              }}
            >
              <Text
                style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}
              >
                🎯 Routing
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                {expandedSections.has('routing') ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedSections.has('routing') && (
              <View style={{ paddingVertical: 8, paddingLeft: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>Route:</Text>
                  <View
                    style={{
                      backgroundColor: getRouteColor(debugInfo.route),
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {debugInfo.route}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>Model:</Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {debugInfo.model}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Tool Calls:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {debugInfo.toolCalls}
                  </Text>
                </View>
              </View>
            )}

            {/* Statistics Section */}
            <TouchableOpacity
              onPress={() => toggleSection('statistics')}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#374151',
              }}
            >
              <Text
                style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}
              >
                📊 Statistics
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                {expandedSections.has('statistics') ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedSections.has('statistics') && (
              <View style={{ paddingVertical: 8, paddingLeft: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Token Count:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {debugInfo.tokenCount}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Chunk Count:
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {debugInfo.chunkCount}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: 12 }}>
                    Errors:
                  </Text>
                  <Text
                    style={{
                      color:
                        debugInfo.errors.length > 0 ? '#EF4444' : '#10B981',
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {debugInfo.errors.length}
                  </Text>
                </View>
              </View>
            )}

            {/* Errors Section */}
            {debugInfo.errors.length > 0 && (
              <>
                <TouchableOpacity
                  onPress={() => toggleSection('errors')}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#374151',
                  }}
                >
                  <Text
                    style={{
                      color: '#EF4444',
                      fontSize: 14,
                      fontWeight: '600',
                    }}
                  >
                    ❌ Errors
                  </Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                    {expandedSections.has('errors') ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>

                {expandedSections.has('errors') && (
                  <View style={{ paddingVertical: 8, paddingLeft: 16 }}>
                    {debugInfo.errors.map((error, index) => (
                      <View key={index} style={{ marginBottom: 4 }}>
                        <Text style={{ color: '#EF4444', fontSize: 11 }}>
                          {error}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={{ padding: 12 }}>
            <Text
              style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center' }}
            >
              No debug information available.{'\n'}
              Send a message to see debug data.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
