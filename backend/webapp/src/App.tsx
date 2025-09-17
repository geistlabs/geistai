import React, { useState } from 'react'
import ChatInterface from './components/ChatInterface'

function App() {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'white',
      color: 'black'
    }}>
      <header style={{ 
        padding: '20px', 
        borderBottom: '1px solid #ccc',
        textAlign: 'center',
        backgroundColor: 'white'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          color: 'black',
          margin: 0
        }}>
          GeistAI Webapp
        </h1>
        <p style={{ 
          fontSize: '14px', 
          color: '#666',
          margin: '5px 0 0 0'
        }}>
          Basic Chat Interface for Testing
        </p>
      </header>
      
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'white'
      }}>
        <ChatInterface />
      </main>
    </div>
  )
}

export default App
