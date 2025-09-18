import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '20px',
    padding: '10px 20px',
    borderBottom: '1px solid #ccc',
    backgroundColor: '#f8f9fa'
  };

  const linkStyle: React.CSSProperties = {
    textDecoration: 'none',
    color: '#333',
    padding: '8px 16px',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  };

  const activeLinkStyle: React.CSSProperties = {
    ...linkStyle,
    backgroundColor: '#007bff',
    color: 'white'
  };

  return (
    <nav style={navStyle}>
      <Link 
        to="/" 
        style={location.pathname === '/' ? activeLinkStyle : linkStyle}
      >
        Chat
      </Link>
      <Link 
        to="/embeddings" 
        style={location.pathname === '/embeddings' ? activeLinkStyle : linkStyle}
      >
        Embeddings
      </Link>
    </nav>
  );
};

export default Navigation;
