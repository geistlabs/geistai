import React, { useState, useEffect } from 'react';
import { ToolCallEvent } from './ChatInterface';

interface ActivityPanelProps {
  toolCallEvents: ToolCallEvent[];
  agentConversations?: any[];
  isVisible: boolean;
  onToggle: () => void;
}

interface ActivityItem {
  id: string;
  type: 'agent' | 'tool';
  name: string;
  status: 'active' | 'completed' | 'error';
  timestamp: Date;
  details?: any;
  icon: string;
  description: string;
}

const ActivityPanel: React.FC<ActivityPanelProps> = ({ 
  toolCallEvents, 
  agentConversations = [], 
  isVisible, 
  onToggle 
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Convert tool call events and agent conversations to activity items
  useEffect(() => {
    const newActivities: ActivityItem[] = [];

    // Add tool call activities
    toolCallEvents.forEach(event => {
      const toolDisplayName = getToolDisplayName(event.toolName);
      const toolIcon = getToolIcon(event.toolName);
      
      newActivities.push({
        id: event.id,
        type: 'tool',
        name: toolDisplayName,
        status: event.status,
        timestamp: event.timestamp,
        details: {
          arguments: event.arguments,
          result: event.result,
          error: event.error
        },
        icon: toolIcon,
        description: getToolDescription(event.toolName, event.arguments)
      });
    });

    // Add agent activities
    agentConversations.forEach(convo => {
      if (convo.messages && convo.messages.length > 0) {
        const agentDisplayName = getAgentDisplayName(convo.agent);
        const agentIcon = '🤖';
        
        newActivities.push({
          id: `agent-${convo.agent}-${convo.messages[0].timestamp}`,
          type: 'agent',
          name: agentDisplayName,
          status: convo.messages.some((msg: any) => msg.isStreaming) ? 'active' : 'completed',
          timestamp: new Date(convo.messages[0].timestamp),
          details: {
            task: convo.task,
            context: convo.context,
            messageCount: convo.messages.length
          },
          icon: agentIcon,
          description: convo.task || 'Processing request...'
        });
      }
    });

    // Sort by timestamp (newest first)
    newActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setActivities(newActivities);
  }, [toolCallEvents, agentConversations]);

  const getToolDisplayName = (toolName: string): string => {
    if (!toolName) return 'Unknown Tool';
    const toolNames: { [key: string]: string } = {
      'brave_web_search': 'Web Search',
      'brave_local_search': 'Local Search',
      'brave_video_search': 'Video Search',
      'brave_image_search': 'Image Search',
      'brave_news_search': 'News Search',
      'brave_summarizer': 'Content Summarizer',
      'fetch': 'Content Fetcher',
      'research_agent': 'Research Specialist',
      'current_info_agent': 'Current Information',
      'creative_agent': 'Creative Assistant',
      'technical_agent': 'Technical Expert',
      'summary_agent': 'Summary Generator'
    };
    return toolNames[toolName] || toolName;
  };

  const getAgentDisplayName = (agentName: string): string => {
    const agentNames: { [key: string]: string } = {
      'research_agent': 'Research Specialist',
      'current_info_agent': 'Current Information',
      'creative_agent': 'Creative Assistant',
      'technical_agent': 'Technical Expert',
      'summary_agent': 'Summary Generator'
    };
    return agentNames[agentName] || agentName;
  };

  const getToolIcon = (toolName: string): string => {
    if (!toolName) return '🔧';
    if (toolName.includes('search')) return '🔍';
    if (toolName.includes('fetch')) return '📄';
    if (toolName.includes('summarizer')) return '📝';
    if (toolName.includes('agent')) return '🤖';
    return '🔧';
  };

  const getToolDescription = (toolName: string, arguments?: any): string => {
    if (!arguments) return 'Processing...';
    
    if (toolName.includes('search')) {
      const query = arguments.query || arguments.q || arguments.search_term;
      return query ? `Searching for: "${query}"` : 'Performing search...';
    }
    
    if (toolName === 'fetch') {
      const url = arguments.url;
      return url ? `Fetching content from: ${new URL(url).hostname}` : 'Fetching content...';
    }
    
    if (toolName.includes('agent')) {
      const task = arguments.task;
      return task ? `Working on: "${task.substring(0, 50)}${task.length > 50 ? '...' : ''}"` : 'Processing request...';
    }
    
    return 'Processing...';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#FFD700'; // Gold
      case 'completed': return '#32CD32'; // Forest Green
      case 'error': return '#DC143C'; // Crimson
      default: return '#C0C0C0'; // Silver
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Complete';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const formatTime = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!isVisible) {
    return (
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={onToggle}
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            border: '1px solid #444',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            color: '#FFD700',
            fontSize: '18px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,215,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          }}
        >
          ⚡
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '380px',
      maxHeight: '70vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      border: '1px solid #444',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 1000,
      overflow: 'hidden',
      fontFamily: '"Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        color: '#1a1a1a',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #444'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '20px' }}>⚡</span>
          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              AI Activity
            </div>
            <div style={{
              fontSize: '11px',
              opacity: 0.8,
              fontWeight: '500'
            }}>
              {activities.length} operations
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            borderRadius: '6px',
            width: '28px',
            height: '28px',
            color: '#1a1a1a',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
          }}
        >
          ×
        </button>
      </div>

      {/* Activity List */}
      <div style={{
        maxHeight: 'calc(70vh - 80px)',
        overflowY: 'auto',
        padding: '8px 0'
      }}>
        {activities.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#888',
            fontSize: '14px'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>✨</div>
            <div>No activity yet</div>
            <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              AI operations will appear here
            </div>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #333',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '18px',
                  minWidth: '20px'
                }}>
                  {activity.icon}
                </div>
                
                <div style={{
                  flex: 1,
                  minWidth: 0
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#fff',
                      letterSpacing: '0.3px'
                    }}>
                      {activity.name}
                    </div>
                    <div style={{
                      background: getStatusColor(activity.status),
                      color: activity.status === 'active' ? '#1a1a1a' : '#fff',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}>
                      {getStatusText(activity.status)}
                    </div>
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    color: '#bbb',
                    lineHeight: '1.4',
                    marginBottom: '4px'
                  }}>
                    {activity.description}
                  </div>
                  
                  <div style={{
                    fontSize: '11px',
                    color: '#888',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>🕒</span>
                    {formatTime(activity.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {activities.length > 0 && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(0,0,0,0.2)',
          borderTop: '1px solid #333',
          fontSize: '11px',
          color: '#888',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span>✨</span>
            <span>Powered by Geist AI</span>
            <span>✨</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityPanel;
