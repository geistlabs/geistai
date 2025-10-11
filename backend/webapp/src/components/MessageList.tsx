import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { Message } from './ChatInterface'
import ToolCallDisplay from './ToolCallDisplay'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '20px',
      backgroundColor: 'white'
    }}>
      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            marginBottom: '15px',
            display: 'flex',
            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
          }}
        >
          <div
            style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: message.role === 'user' ? 'black' : '#f0f0f0',
              color: message.role === 'user' ? 'white' : 'black',
              fontSize: '14px',
              lineHeight: '1.4',
              wordWrap: 'break-word',
              position: 'relative'
            }}
          >
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                // Custom styling for markdown elements
                p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: '1.4' }}>{children}</p>,
                h1: ({ children }) => <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{children}</h3>,
                ul: ({ children }) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px' }}>{children}</ol>,
                li: ({ children }) => <li style={{ margin: '0 0 2px 0' }}>{children}</li>,
                code: ({ children }) => <code style={{ 
                  backgroundColor: '#f1f3f4', 
                  padding: '2px 4px', 
                  borderRadius: '3px', 
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>{children}</code>,
                pre: ({ children }) => <pre style={{ 
                  backgroundColor: '#f1f3f4', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  overflow: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  margin: '0 0 8px 0'
                }}>{children}</pre>,
                blockquote: ({ children }) => <blockquote style={{ 
                  borderLeft: '3px solid #ddd', 
                  paddingLeft: '12px', 
                  margin: '0 0 8px 0',
                  fontStyle: 'italic',
                  color: '#666'
                }}>{children}</blockquote>,
                strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                a: ({ href, children, ...props }) => <a 
                  href={href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: '#007bff', 
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                  {...props}
                >{children}</a>
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '14px',
                  backgroundColor: '#007bff',
                  marginLeft: '4px',
                  animation: 'blink 1s infinite'
                }}
              />
            )}
            
            {/* Display embedded agent conversations */}
            {message.agentConversations && message.agentConversations.length > 0 && (
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
                  Agent Activity:
                </div>
                {message.agentConversations.map((agentConvo, index) => (
                  <div key={index} style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#495057',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {agentConvo.agent}
                    </div>
                    
                    {/* Display Task and Context separately if available */}
                    {(agentConvo.task || agentConvo.context) && (
                      <div style={{
                        marginBottom: '8px',
                        padding: '6px 8px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {agentConvo.task && (
                          <div style={{ marginBottom: '4px' }}>
                            <strong style={{ color: '#495057' }}>Task:</strong>
                            <div style={{ color: '#6c757d', marginTop: '2px' }}>
                              {agentConvo.task}
                            </div>
                          </div>
                        )}
                        {agentConvo.context && (
                          <div>
                            <strong style={{ color: '#495057' }}>Context:</strong>
                            <div style={{ color: '#6c757d', marginTop: '2px' }}>
                              {agentConvo.context}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Display agent messages */}
                    <div style={{
                      fontSize: '13px',
                      color: '#212529',
                      lineHeight: '1.4'
                    }}>
                      {agentConvo.messages.map((agentMsg, msgIndex) => (
                        <div key={msgIndex}>
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              // Simplified styling for agent messages
                              p: ({ children }) => <p style={{ margin: '0 0 4px 0', lineHeight: '1.3' }}>{children}</p>,
                              h1: ({ children }) => <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{children}</h1>,
                              h2: ({ children }) => <h2 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 3px 0' }}>{children}</h2>,
                              h3: ({ children }) => <h3 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 2px 0' }}>{children}</h3>,
                              ul: ({ children }) => <ul style={{ margin: '0 0 4px 0', paddingLeft: '16px' }}>{children}</ul>,
                              ol: ({ children }) => <ol style={{ margin: '0 0 4px 0', paddingLeft: '16px' }}>{children}</ol>,
                              li: ({ children }) => <li style={{ margin: '0 0 1px 0' }}>{children}</li>,
                              code: ({ children }) => <code style={{ 
                                backgroundColor: '#e9ecef', 
                                padding: '1px 3px', 
                                borderRadius: '2px', 
                                fontSize: '11px',
                                fontFamily: 'monospace'
                              }}>{children}</code>,
                              pre: ({ children }) => <pre style={{ 
                                backgroundColor: '#e9ecef', 
                                padding: '4px', 
                                borderRadius: '3px', 
                                overflow: 'auto',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                margin: '0 0 4px 0'
                              }}>{children}</pre>,
                              strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                              em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                              a: ({ href, children, ...props }) => <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                  color: '#007bff', 
                                  textDecoration: 'none',
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                                {...props}
                              >{children}</a>
                            }}
                          >
                            {agentMsg.content}
                          </ReactMarkdown>
                          {agentMsg.isStreaming && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '12px',
                                backgroundColor: '#28a745',
                                marginLeft: '3px',
                                animation: 'blink 1s infinite'
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Display collected links section */}
            {message.collectedLinks && message.collectedLinks.length > 0 && (
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
                  Sources & Links ({message.collectedLinks.length}):
                </div>
                <div style={{
                  display: 'grid',
                  gap: '8px'
                }}>
                  {message.collectedLinks.map((link) => (
                    <div key={link.id} style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef',
                      fontSize: '13px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}>
                        <div style={{
                          flex: 1,
                          minWidth: 0
                        }}>
                          <div style={{
                            fontWeight: '600',
                            color: '#495057',
                            marginBottom: '4px',
                            wordBreak: 'break-word'
                          }}>
                            {link.title || link.source || 'Untitled'}
                          </div>
                          {link.snippet && (
                            <div style={{
                              color: '#6c757d',
                              fontSize: '12px',
                              marginBottom: '4px',
                              lineHeight: '1.4'
                            }}>
                              {link.snippet.length > 150 
                                ? `${link.snippet.substring(0, 150)}...` 
                                : link.snippet}
                            </div>
                          )}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color: '#6c757d'
                          }}>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                color: '#007bff',
                                textDecoration: 'none',
                                fontWeight: '500',
                                wordBreak: 'break-all'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                            >
                              {link.url}
                            </a>
                            {link.agent && link.agent !== 'main' && (
                              <span style={{
                                backgroundColor: '#e9ecef',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {link.agent}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              textDecoration: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#0056b3';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#007bff';
                            }}
                          >
                            Visit
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Display tool call events */}
            {message.toolCallEvents && message.toolCallEvents.length > 0 && (
              <ToolCallDisplay toolCallEvents={message.toolCallEvents} />
            )}
            
            {/* Display citations if they exist */}
            {(() => {
              return null;
            })()}
            {message.citations && message.citations.length > 0 && (
              <div style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #ddd',
                fontSize: '12px',
                color: '#666'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Sources:</div>
                {message.citations.map((citation, index) => (
                  <div key={index} style={{ marginBottom: '3px' }}>
                    [{citation.number || index + 1}] {citation.source || citation.name}
                    {citation.url && (
                      <a 
                        href={citation.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#007bff', 
                          textDecoration: 'none',
                          marginLeft: '5px'
                        }}
                      >
                        🔗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          marginBottom: '15px'
        }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#f0f0f0',
              color: 'black',
              fontSize: '14px'
            }}
          >
            Thinking...
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageList
