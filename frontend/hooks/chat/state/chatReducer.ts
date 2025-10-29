import {
  AgentMessage,
  ChatMessage,
  EnhancedMessage,
  NegotiationResult,
} from '../types/ChatTypes';

export interface ChatState {
  messages: ChatMessage[];
  enhancedMessages: EnhancedMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  negotiationResult: NegotiationResult | null;
  toolCallEvents: any[];
  agentEvents: AgentMessage[];
  orchestratorStatus: {
    isActive: boolean;
    currentAgent?: string;
    status?: string;
  };
}

export type ChatAction =
  | { type: 'START_LOADING' }
  | { type: 'START_STREAMING' }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'ADD_ENHANCED_MESSAGE'; message: EnhancedMessage }
  | { type: 'UPDATE_MESSAGE'; id: string; content: string }
  | {
      type: 'UPDATE_ENHANCED_MESSAGE';
      id: string;
      updates: Partial<EnhancedMessage>;
    }
  | { type: 'SET_ERROR'; error: Error }
  | { type: 'SET_NEGOTIATION_RESULT'; result: NegotiationResult | null }
  | { type: 'STOP_STREAMING' }
  | { type: 'ADD_TOOL_CALL'; event: any }
  | { type: 'ADD_AGENT_EVENT'; event: AgentMessage }
  | {
      type: 'UPDATE_ORCHESTRATOR_STATUS';
      status: Partial<ChatState['orchestratorStatus']>;
    }
  | { type: 'CLEAR_MESSAGES' };

export const initialState: ChatState = {
  messages: [],
  enhancedMessages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  negotiationResult: null,
  toolCallEvents: [],
  agentEvents: [],
  orchestratorStatus: {
    isActive: false,
  },
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'START_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'START_STREAMING':
      return {
        ...state,
        isStreaming: true,
        isLoading: false,
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case 'ADD_ENHANCED_MESSAGE':
      return {
        ...state,
        enhancedMessages: [...state.enhancedMessages, action.message],
      };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.id ? { ...msg, content: action.content } : msg,
        ),
      };

    case 'UPDATE_ENHANCED_MESSAGE':
      return {
        ...state,
        enhancedMessages: state.enhancedMessages.map(msg =>
          msg.id === action.id ? { ...msg, ...action.updates } : msg,
        ),
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        isStreaming: false,
      };

    case 'SET_NEGOTIATION_RESULT':
      return {
        ...state,
        negotiationResult: action.result,
      };

    case 'STOP_STREAMING':
      return {
        ...state,
        isStreaming: false,
      };

    case 'ADD_TOOL_CALL':
      return {
        ...state,
        toolCallEvents: [...state.toolCallEvents, action.event],
      };

    case 'ADD_AGENT_EVENT':
      return {
        ...state,
        agentEvents: [...state.agentEvents, action.event],
      };

    case 'UPDATE_ORCHESTRATOR_STATUS':
      return {
        ...state,
        orchestratorStatus: {
          ...state.orchestratorStatus,
          ...action.status,
        },
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        enhancedMessages: [],
        toolCallEvents: [],
        agentEvents: [],
        orchestratorStatus: { isActive: false },
      };

    default:
      return state;
  }
}
