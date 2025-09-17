import React, { useState } from 'react'

interface MessageInputProps {
  onSendMessage: (message: string) => void
  disabled: boolean
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, disabled }) => {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue)
      setInputValue('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div style={{
      padding: '20px',
      borderTop: '1px solid #ccc',
      backgroundColor: 'white'
    }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
          disabled={disabled}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: 'white',
            color: 'black',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={disabled || !inputValue.trim()}
          style={{
            padding: '12px 24px',
            backgroundColor: disabled || !inputValue.trim() ? '#ccc' : 'black',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: disabled || !inputValue.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default MessageInput
