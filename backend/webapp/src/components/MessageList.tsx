import React from 'react'
import { Message } from './ChatInterface'

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
              wordWrap: 'break-word'
            }}
          >
            {message.content}
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
