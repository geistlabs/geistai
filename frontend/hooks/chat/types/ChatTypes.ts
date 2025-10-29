export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Citation {
  url: string;
  source?: string;
  snippet?: string;
}

export interface CollectedLink {
  id: string;
  url: string;
  title?: string;
  source?: string;
  snippet?: string;
  agent?: string;
  type: 'citation' | 'link';
}

export interface ToolCallEvent {
  id: string;
  type: 'start' | 'complete' | 'error';
  toolName: string;
  arguments?: any;
  result?: any;
  error?: string;
  timestamp: Date;
  status: 'active' | 'completed' | 'error';
}

export interface AgentConversation {
  agent: string;
  messages: EnhancedMessage[];
  timestamp: Date;
  type: 'start' | 'token' | 'complete' | 'error';
  status?: string;
  task?: string;
  context?: string;
}

export interface EnhancedMessage extends ChatMessage {
  isStreaming?: boolean;
  citations?: Citation[];
  agentConversations?: AgentConversation[];
  collectedLinks?: CollectedLink[];
  toolCallEvents?: ToolCallEvent[];
}

export interface NegotiationResult {
  final_price: number;
  package_id: string;
  negotiation_summary: string;
}

export interface AgentMessage {
  agent: string;
  content: string;
  timestamp: number;
  type: 'start' | 'token' | 'complete' | 'error';
  status?: string;
  citations?: any[];
  meta?: any;
}
