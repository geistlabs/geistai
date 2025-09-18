# Chat Context with Embeddings

This webapp now includes comprehensive chat context functionality that automatically creates embeddings for all chat messages and associates them with specific chat conversations.

## 🎯 Key Features

### **1. Automatic Embedding Creation**
- **Every chat message** (user and assistant) automatically gets an embedding
- **Real-time processing** - embeddings are created as messages are sent
- **Persistent storage** in IndexedDB with chat context metadata

### **2. Chat-Specific Context**
- **Unique Chat ID** for each conversation session
- **Message-level tracking** with individual message IDs
- **Role identification** (user vs assistant messages)
- **Timestamp preservation** for chronological ordering

### **3. Enhanced Embeddings Management**
- **Filter by chat** in the embeddings explorer
- **View chat context** directly in the chat interface
- **Cross-chat similarity search** capabilities
- **Chat statistics** and analytics

## 🔧 Technical Implementation

### **Database Schema Updates**
```typescript
interface StoredEmbedding {
  id: string;
  text: string;
  embedding: number[];
  model: string;
  createdAt: Date;
  chatId?: string;        // NEW: Chat conversation ID
  messageId?: string;     // NEW: Specific message ID
  metadata?: {
    role: 'user' | 'assistant';
    timestamp: string;
    usage: object;
    source: 'chat_message' | 'manual_creation';
  };
}
```

### **IndexedDB Upgrades**
- **Version 2** database with new indexes
- **chatId index** for fast chat-based queries
- **messageId index** for message-specific lookups
- **Automatic migration** from version 1

### **New API Methods**
```typescript
// Get all embeddings for a specific chat
embeddingDB.getEmbeddingsByChatId(chatId: string)

// Get embedding for a specific message
embeddingDB.getEmbeddingByMessageId(messageId: string)

// Delete all embeddings for a chat
embeddingDB.deleteEmbeddingsByChatId(chatId: string)
```

## 🚀 Usage Examples

### **1. Chat Interface with Context**
- Navigate to `/` to see the chat interface
- **Bottom panel** shows real-time embeddings for the current chat
- **Automatic embedding creation** for every message
- **Visual indicators** for user vs assistant messages

### **2. Embeddings Explorer with Chat Filtering**
- Navigate to `/embeddings` to manage all embeddings
- **Filter by chat** using the "All Chats" dropdown
- **View chat context** in embedding metadata
- **Search across conversations** or within specific chats

### **3. Cross-Chat Context**
```typescript
import { getCrossChatContext, findSimilarEmbeddings } from './lib/embeddingUtils';

// Find similar messages from other chats
const similarMessages = findSimilarEmbeddings(
  currentMessageEmbedding,
  allEmbeddings,
  0.8, // 80% similarity threshold
  5    // Top 5 results
);

// Get context from other conversations
const crossChatContext = getCrossChatContext(currentChatId, allEmbeddings);
```

## 📊 Chat Context Analytics

### **Embedding Statistics**
- **Total embeddings** per chat
- **User vs assistant** message counts
- **Average embedding dimensions**
- **Models used** in the conversation

### **Similarity Search**
- **Cosine similarity** calculations
- **Threshold-based filtering**
- **Cross-chat context** discovery
- **Chronological ordering** of results

## 🔄 Data Flow

1. **User sends message** → ChatInterface
2. **Message stored** in chat state
3. **Embedding created** automatically via embeddings API
4. **Stored in IndexedDB** with chatId and messageId
5. **ChatEmbeddings component** updates in real-time
6. **Embeddings explorer** can filter by chat

## 🎨 UI Components

### **ChatEmbeddings Component**
- **Real-time display** of chat embeddings
- **Role-based color coding** (blue for user, green for assistant)
- **Truncated text preview** with full text on hover
- **Compact layout** for chat interface integration

### **Enhanced EmbeddingExplorer**
- **Chat filter dropdown** showing all available chats
- **Chat ID display** in embedding metadata
- **Role indicators** for message context
- **Bulk operations** by chat

## 🔍 Advanced Features

### **Similarity Search**
```typescript
// Find similar messages across all chats
const queryEmbedding = await embeddingsAPI.embed({ input: "search query" });
const similar = findSimilarEmbeddings(
  queryEmbedding.data[0].embedding,
  allEmbeddings,
  0.7, // 70% similarity
  10   // Top 10 results
);
```

### **Chat Context Retrieval**
```typescript
// Get all context for a specific chat
const chatContext = getChatContext(chatId, allEmbeddings);

// Get recent context from other chats
const crossChatContext = getCrossChatContext(chatId, allEmbeddings, 5);
```

## 🛠️ Configuration

### **Embedding Model**
- **Default**: `all-MiniLM-L6-v2`
- **Configurable** in ChatInterface component
- **Consistent** across chat and manual embeddings

### **Storage Limits**
- **IndexedDB** handles large embedding collections
- **Automatic cleanup** methods available
- **Chat-based deletion** for conversation management

## 📈 Benefits

1. **Context Preservation** - Chat history maintained across sessions
2. **Cross-Conversation Learning** - Find similar topics across chats
3. **Enhanced Search** - Semantic search through all conversations
4. **Analytics** - Understand conversation patterns and topics
5. **Scalability** - Efficient storage and retrieval of embeddings

## 🔮 Future Enhancements

- **Semantic search** across all chat history
- **Topic clustering** and conversation summarization
- **Export/import** chat contexts
- **Advanced analytics** and conversation insights
- **Integration** with external knowledge bases
