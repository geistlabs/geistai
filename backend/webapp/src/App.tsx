import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import ChatPage from './pages/ChatPage'
import EmbeddingsPage from './pages/EmbeddingsPage'

function App() {
  return (
    <Router>
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
            Chat Interface & Embeddings Management
          </p>
        </header>
        
        <Navigation />
        
        <main style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'white'
        }}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/embeddings" element={<EmbeddingsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
