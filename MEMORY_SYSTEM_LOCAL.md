# 🧠 Local Memory System

## 📱 **100% On-Device Storage**

The memory system is now completely local and stores everything on the device:

### 🗄️ **Local Storage Components**

1. **SQLite Databases**:
   - `geist_v2_chats.db` - Chat messages and conversations
   - `geist_memories.db` - Extracted memories with embeddings
   - `vectors.db` - Manual embeddings (existing)

2. **Memory Data Stored Locally**:
   - ✅ Key facts extracted from conversations
   - ✅ Embeddings for semantic search
   - ✅ Categories (personal, technical, preference, context, other)
   - ✅ Relevance scores and timestamps
   - ✅ Source chat and message IDs

### 🔄 **Local Processing Flow**

1. **Memory Extraction** (On-Device):
   - Uses existing `/api/chat` endpoint to call LLM
   - Extracts facts using structured prompts
   - Stores results in local SQLite database

2. **Embedding Generation** (Hybrid):
   - Uses existing `/embeddings/embed` endpoint for vector generation
   - Stores embeddings locally in SQLite as binary blobs

3. **Similarity Search** (On-Device):
   - Cosine similarity calculations performed locally
   - No data sent to backend for search operations
   - Fast local indexing with SQLite

4. **Context Injection** (On-Device):
   - Retrieves relevant memories from local storage
   - Formats context for LLM consumption
   - Injects as system messages

### 🔒 **Privacy Benefits**

- **No memory data sent to backend** (except for embedding generation)
- **All personal facts stay on device**
- **Search and retrieval completely local**
- **Works offline** (once embeddings are generated)

### 📊 **Storage Efficiency**

- **Indexed SQLite tables** for fast queries
- **Binary embedding storage** for space efficiency
- **Automatic cleanup** options available
- **Per-chat memory management**

### 🎯 **Usage**

The system works transparently:

1. **Have conversations** - memories extracted automatically
2. **Start new chats** - relevant context injected automatically
3. **Manage memories** - view/search/delete in Storage tab
4. **All processing local** - fast and private

### 🚀 **Performance**

- **Fast local search** using SQLite indexes
- **Efficient similarity calculations** with normalized vectors
- **Minimal memory footprint** with optimized storage
- **Real-time context retrieval** without network delays

## 🎉 Ready to Use!

Your memory system is now completely self-contained and privacy-focused. All personal information and conversation context stays on your device while still providing intelligent, contextual responses.
