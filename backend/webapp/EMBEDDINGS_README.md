# Embeddings Feature

This webapp now includes a comprehensive embeddings management system accessible at `/embeddings`.

## Features

### 1. Create Embeddings
- Enter text to generate embeddings using the embeddings API
- Choose from available models (all-MiniLM-L6-v2, all-mpnet-base-v2, paraphrase-MiniLM-L6-v2)
- Automatically stores embeddings in IndexedDB for offline access

### 2. Explore Stored Embeddings
- View all stored embeddings with search and filtering
- Filter by model type
- Sort by creation date or alphabetically
- See embedding dimensions and preview values
- Delete unwanted embeddings

### 3. IndexedDB Storage
- Persistent local storage using browser's IndexedDB
- Embeddings survive browser restarts
- Fast local search and retrieval
- No server dependency for viewing stored embeddings

## API Integration

The embeddings feature integrates with the embeddings service running on `http://localhost:8001` with these endpoints:

- `POST /embed` - Generate embeddings for text
- `GET /models` - List available models
- `GET /health` - Check service health

## Usage

1. Navigate to `/embeddings` in the webapp
2. Enter text in the "Create New Embedding" section
3. Select a model (default: all-MiniLM-L6-v2)
4. Click "Create Embedding" to generate and store
5. View, search, and manage stored embeddings below

## Technical Details

- **Frontend**: React with TypeScript
- **Routing**: React Router DOM
- **Storage**: IndexedDB with custom wrapper
- **API Client**: Fetch-based with error handling
- **UI**: Inline styles for simplicity

## File Structure

```
src/
├── api/
│   └── embeddings.ts          # API client for embeddings service
├── components/
│   ├── embeddings/
│   │   ├── EmbeddingCreator.tsx   # Form to create new embeddings
│   │   └── EmbeddingExplorer.tsx  # List and manage stored embeddings
│   └── Navigation.tsx         # Navigation between routes
├── lib/
│   └── indexedDB.ts          # IndexedDB wrapper for embeddings storage
├── pages/
│   ├── ChatPage.tsx          # Original chat interface
│   └── EmbeddingsPage.tsx    # Main embeddings management page
└── App.tsx                   # Updated with routing
```
