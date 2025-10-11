import React, { useState, useEffect } from 'react'
import { ToolCallEvent } from './ChatInterface'

interface ToolCallDisplayProps {
  toolCallEvents: ToolCallEvent[]
}

interface FaviconCache {
  [domain: string]: string
}

const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ toolCallEvents }) => {
  const [faviconCache, setFaviconCache] = useState<FaviconCache>({})

  // Function to extract domain from URL
  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return ''
    }
  }

  // Function to get favicon URL
  const getFaviconUrl = (domain: string): string => {
    if (!domain) return ''
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
  }

  // Function to extract URLs from tool arguments and results
  const extractUrls = (toolCall: ToolCallEvent): string[] => {
    const urls: string[] = []
    
    // Extract from arguments
    if (toolCall.arguments) {
      const argsStr = JSON.stringify(toolCall.arguments)
      const urlMatches = argsStr.match(/https?:\/\/[^\s"']+/g)
      if (urlMatches) {
        urls.push(...urlMatches)
      }
    }
    
    // Extract from results
    if (toolCall.result) {
      const resultStr = JSON.stringify(toolCall.result)
      const urlMatches = resultStr.match(/https?:\/\/[^\s"']+/g)
      if (urlMatches) {
        urls.push(...urlMatches)
      }
    }
    
    return [...new Set(urls)] // Remove duplicates
  }

  // Function to get tool display name
  const getToolDisplayName = (toolName: string): string => {
    if (!toolName) return 'Unknown Tool'
    const toolNames: { [key: string]: string } = {
      'brave_web_search': 'Web Search',
      'fetch': 'Fetch Content',
      'research_agent': 'Research Agent',
      'current_info_agent': 'Current Info Agent',
      'creative_agent': 'Creative Agent',
      'technical_agent': 'Technical Agent',
      'summary_agent': 'Summary Agent'
    }
    return toolNames[toolName] || toolName
  }

  // Function to get tool icon
  const getToolIcon = (toolName: string): string => {
    if (!toolName) return '🔧'
    if (toolName.includes('search')) return '🔍'
    if (toolName.includes('fetch')) return '📄'
    if (toolName.includes('agent')) return '🤖'
    return '🔧'
  }

  if (!toolCallEvents || toolCallEvents.length === 0) {
    return null
  }

  return (
    <div style={{
      marginTop: '15px',
      paddingTop: '15px',
      borderTop: '1px solid #e0e0e0'
    }}>
      <div style={{
        fontSize: '12px',
        color: '#666',
        marginBottom: '10px',
        fontWeight: 'bold'
      }}>
        Tool Activity ({toolCallEvents.length}):
      </div>
      
      <div style={{
        display: 'grid',
        gap: '8px'
      }}>
        {toolCallEvents.map((toolCall) => {
          const urls = extractUrls(toolCall)
          const domains = urls.map(extractDomain).filter(Boolean)
          
          return (
            <div key={toolCall.id} style={{
              padding: '8px 12px',
              backgroundColor: toolCall.status === 'active' ? '#e3f2fd' : 
                              toolCall.status === 'completed' ? '#e8f5e8' : '#ffebee',
              borderRadius: '6px',
              border: `1px solid ${toolCall.status === 'active' ? '#2196f3' : 
                                  toolCall.status === 'completed' ? '#4caf50' : '#f44336'}`,
              fontSize: '13px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ fontSize: '16px' }}>
                  {getToolIcon(toolCall.toolName)}
                </span>
                <span style={{
                  fontWeight: '600',
                  color: '#495057'
                }}>
                  {getToolDisplayName(toolCall.toolName)}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: toolCall.status === 'active' ? '#2196f3' : 
                                  toolCall.status === 'completed' ? '#4caf50' : '#f44336',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {toolCall.status}
                </span>
              </div>
              
              {/* Display search query for web search tools */}
              {toolCall.toolName && toolCall.toolName.includes('search') && toolCall.arguments && (
                <div style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: '#6c757d'
                }}>
                  <strong>Query:</strong> {toolCall.arguments.query || toolCall.arguments.q || toolCall.arguments.search_term || 'N/A'}
                  {process.env.NODE_ENV === 'development' && (
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                      Debug args: {JSON.stringify(toolCall.arguments)}
                    </div>
                  )}
                </div>
              )}

              {/* Display favicons for domains */}
              {domains.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#6c757d'
                  }}>
                    Sites:
                  </span>
                  {domains.map((domain, index) => {
                    // Find the corresponding URL for this domain
                    const correspondingUrl = urls.find(url => extractDomain(url) === domain)
                    const displayUrl = correspondingUrl || `https://${domain}`
                    
                    return (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '2px 4px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '3px',
                        fontSize: '11px'
                      }}>
                        <img 
                          src={getFaviconUrl(domain)}
                          alt={`${domain} favicon`}
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '1px'
                          }}
                          onError={(e) => {
                            // Hide broken favicon images
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <a 
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#007bff',
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none'
                          }}
                        >
                          {domain}
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Display actual URLs found in results */}
              {urls.length > 0 && toolCall.status === 'completed' && (
                <div style={{
                  marginTop: '6px',
                  fontSize: '11px'
                }}>
                  <div style={{
                    color: '#6c757d',
                    marginBottom: '4px',
                    fontWeight: '500'
                  }}>
                    Found URLs:
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    {urls.slice(0, 3).map((url, index) => (
                      <a 
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#007bff',
                          textDecoration: 'none',
                          fontSize: '10px',
                          padding: '2px 4px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '3px',
                          border: '1px solid #e9ecef',
                          wordBreak: 'break-all'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline'
                          e.currentTarget.style.backgroundColor = '#e9ecef'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none'
                          e.currentTarget.style.backgroundColor = '#f8f9fa'
                        }}
                      >
                        {url}
                      </a>
                    ))}
                    {urls.length > 3 && (
                      <div style={{
                        fontSize: '10px',
                        color: '#6c757d',
                        fontStyle: 'italic'
                      }}>
                        ... and {urls.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Display error if any */}
              {toolCall.error && (
                <div style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: '#d32f2f',
                  fontStyle: 'italic'
                }}>
                  Error: {toolCall.error}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ToolCallDisplay
