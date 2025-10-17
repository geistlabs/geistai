import React, { useState } from "react";
import { ChatMessage, sendStreamingMessage } from "../api/chat";
import { extractCitationsAndCleanText } from "../utils/citationParser";
import ActivityPanel from "./ActivityPanel";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean; // Indicates if this message is currently being streamed
  citations?: any[];
  agentConversations?: AgentConvo[]; // Agent conversations associated with this message
  collectedLinks?: CollectedLink[]; // All unique links collected from this message and its agents
  toolCallEvents?: ToolCallEvent[]; // Tool call events associated with this message
}

export interface CollectedLink {
  id: string;
  url: string;
  title?: string;
  source?: string;
  snippet?: string;
  agent?: string;
  type: "citation" | "link";
}

export interface ToolCallEvent {
  id: string;
  type: "start" | "complete" | "error";
  toolName: string;
  arguments?: any;
  result?: any;
  error?: string;
  timestamp: Date;
  status: "active" | "completed" | "error";
}

interface ChatInterfaceProps {
  chatId?: string; // Optional chat ID prop
}

interface AgentConvo {
  agent: string;
  messages: Message[];
  timestamp: Date;
  type: "start" | "token" | "complete" | "error";
  status?: string;
  task?: string;
  context?: string;
}

// Removed getUniqueCitations function - no longer needed

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatId: propChatId,
}) => {
  const [chatId] = useState(() => propChatId || crypto.randomUUID()); // Use prop or generate unique chat ID
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! This is a basic chat interface for testing the GeistAI router. Type a message to get started.",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for future reasoning display feature
  const [reasoningContent, setReasoningContent] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for future reasoning toggle feature
  const [showReasoning, setShowReasoning] = useState(false);

  console.log("🎯 [ChatInterface] Component initialized:", {
    chatId,
    initialMessageCount: messages.length,
    hasPropChatId: !!propChatId,
  });

  // Remove the separate agentConvos state - we'll embed them in messages instead

  // Function to collect and deduplicate links from a message and its agent conversations
  const collectLinksFromMessage = (message: Message): CollectedLink[] => {
    const links: CollectedLink[] = [];
    const seenUrls = new Set<string>();

    // Collect links from main message citations
    if (message.citations) {
      message.citations.forEach((citation, index) => {
        if (citation.url && !seenUrls.has(citation.url)) {
          seenUrls.add(citation.url);
          links.push({
            id: `citation-${message.id}-${index}`,
            url: citation.url,
            title: citation.source,
            source: citation.source,
            snippet: citation.snippet,
            agent: "main",
            type: "citation",
          });
        }
      });
    }

    // Collect links from agent conversations
    if (message.agentConversations) {
      message.agentConversations.forEach((agentConvo) => {
        if (agentConvo.messages) {
          agentConvo.messages.forEach((agentMsg) => {
            // Parse citations from agent message content
            if (agentMsg.content) {
              const { citations } = extractCitationsAndCleanText(
                agentMsg.content
              );
              citations.forEach((citation, index) => {
                if (citation.url && !seenUrls.has(citation.url)) {
                  seenUrls.add(citation.url);
                  links.push({
                    id: `agent-${agentConvo.agent}-${index}`,
                    url: citation.url,
                    title: citation.source,
                    source: citation.source,
                    snippet: citation.snippet,
                    agent: agentConvo.agent,
                    type: "citation",
                  });
                }
              });
            }
          });
        }
      });
    }

    return links;
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isActivityPanelVisible, setIsActivityPanelVisible] = useState(false);

  // Function to create embedding for a message
  const createMessageEmbedding = async (message: Message) => {
    try {
      const { embeddingsAPI } = await import("../api/embeddings");
      const { embeddingDB } = await import("../lib/indexedDB");

      const response = await embeddingsAPI.embed({
        input: message.content,
        model: "all-MiniLM-L6-v2",
      });

      if (response.data.length > 0) {
        const embeddingData = response.data[0];

        await embeddingDB.saveEmbedding({
          text: message.content,
          embedding: embeddingData.embedding,
          model: response.model,
          chatId: chatId,
          messageId: message.id,
          metadata: {
            role: message.role,
            timestamp: message.timestamp.toISOString(),
            usage: response.usage,
          },
        });
      }
    } catch (error) {
      console.error("Failed to create embedding for message:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: "user",
      timestamp: new Date(),
    };

    console.log("🚀 [ChatInterface] Starting new message:", {
      userMessage,
      currentMessageCount: messages.length,
      chatId,
    });

    setMessages((prev) => {
      const updated = [...prev, userMessage];
      console.log(
        "📝 [ChatInterface] Added user message, total messages:",
        updated.length
      );
      return updated;
    });
    setIsLoading(true);

    // Create embedding for user message
    createMessageEmbedding(userMessage);

    // Create streaming assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
      isStreaming: true,
    };

    console.log("🤖 [ChatInterface] Creating assistant message:", {
      assistantMessageId,
      assistantMessage,
    });

    setMessages((prev) => {
      const updated = [...prev, assistantMessage];
      console.log(
        "📝 [ChatInterface] Added assistant message, total messages:",
        updated.length
      );
      return updated;
    });

    // Convert messages to ChatMessage format for API
    const conversationHistory: ChatMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log("📤 [ChatInterface] Starting streaming message:", {
      userContent: content.trim(),
      conversationHistoryLength: conversationHistory.length,
      assistantMessageId,
    });

    try {
      await sendStreamingMessage(
        content.trim(),
        conversationHistory,
        // onToken callback
        (token: string) => {
          console.log("🔤 [ChatInterface] Received token:", {
            token: token.substring(0, 50) + (token.length > 50 ? "..." : ""),
            tokenLength: token.length,
            tokenType: typeof token,
            assistantMessageId,
          });

          // DEBUG: Check if token is actually a string
          if (typeof token !== "string") {
            console.error("❌ [ChatInterface] token is not a string!", {
              actualType: typeof token,
              actualValue: token,
              tokenKeys: typeof token === "object" ? Object.keys(token) : "N/A",
            });
            return; // Don't append non-string tokens
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + token }
                : msg
            )
          );
        },

        ({
          agent,
          token,
          isStreaming,
          task,
          context,
        }: {
          agent: string;
          token: string;
          isStreaming?: boolean;
          task?: string;
          context?: string;
        }) => {
          console.log("🤖 [ChatInterface] Agent token received:", {
            agent,
            token: token.substring(0, 50) + (token.length > 50 ? "..." : ""),
            tokenLength: token.length,
            isStreaming,
            task,
            context,
            assistantMessageId,
          });
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                // Get or create agent conversations for this message
                const agentConvos = msg.agentConversations || [];

                // Find existing agent conversation
                const existingIdx = agentConvos.findIndex(
                  (convo) => convo.agent === agent
                );

                let updatedAgentConvos;
                if (existingIdx !== -1) {
                  console.log(
                    "🔄 [ChatInterface] Updating existing agent conversation:",
                    {
                      agent,
                      existingIdx,
                      currentMessagesCount:
                        agentConvos[existingIdx].messages.length,
                    }
                  );
                  // Update existing agent conversation
                  updatedAgentConvos = agentConvos.map((convo, idx) =>
                    idx === existingIdx
                      ? {
                          ...convo,
                          messages:
                            convo.messages.length > 0
                              ? [
                                  {
                                    ...convo.messages[0],
                                    isStreaming,
                                    content: convo.messages[0].content + token,
                                  },
                                  ...convo.messages.slice(1),
                                ]
                              : [
                                  {
                                    id: token,
                                    content: token,
                                    role: "assistant" as const,
                                    timestamp: new Date(),
                                    isStreaming,
                                  },
                                ],
                        }
                      : convo
                  );
                } else {
                  console.log(
                    "🆕 [ChatInterface] Creating new agent conversation:",
                    {
                      agent,
                      task,
                      context,
                      totalAgentConvos: agentConvos.length,
                    }
                  );
                  // Create new agent conversation
                  updatedAgentConvos = [
                    ...agentConvos,
                    {
                      timestamp: new Date(),
                      type: "token" as const,
                      agent,
                      task,
                      context,
                      messages: [
                        {
                          id: token,
                          content: token,
                          role: "assistant" as const,
                          timestamp: new Date(),
                          isStreaming: true,
                        },
                      ],
                    },
                  ];
                }

                return { ...msg, agentConversations: updatedAgentConvos };
              }
              return msg;
            })
          );
        },
        // onToolCallEvent callback
        ({
          type,
          toolName,
          arguments: args,
          result,
          error,
        }: {
          type: string;
          toolName: string;
          arguments?: any;
          result?: any;
          error?: string;
        }) => {
          console.log("🛠️ [ChatInterface] Tool call event:", {
            type,
            toolName,
            arguments: args,
            hasResult: !!result,
            hasError: !!error,
            assistantMessageId,
          });
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                const toolCallEvents = msg.toolCallEvents || [];
                const eventId = `${toolName}-${Date.now()}-${Math.random()}`;

                if (type === "start") {
                  console.log("🚀 [ChatInterface] Starting tool call:", {
                    toolName,
                    arguments: args,
                    eventId,
                  });
                  // Add new tool call event
                  const newEvent: ToolCallEvent = {
                    id: eventId,
                    type: "start",
                    toolName,
                    arguments: args,
                    timestamp: new Date(),
                    status: "active",
                  };
                  return {
                    ...msg,
                    toolCallEvents: [...toolCallEvents, newEvent],
                  };
                } else if (type === "complete" || type === "error") {
                  console.log(
                    `${
                      type === "complete" ? "✅" : "❌"
                    } [ChatInterface] Tool call ${type}:`,
                    {
                      toolName,
                      hasResult: !!result,
                      hasError: !!error,
                    }
                  );
                  // Update existing tool call event
                  const updatedEvents: ToolCallEvent[] = toolCallEvents.map(
                    (event) => {
                      if (
                        event.toolName === toolName &&
                        event.status === "active"
                      ) {
                        return {
                          ...event,
                          type: type as "complete" | "error",
                          result,
                          error,
                          status: (type === "complete"
                            ? "completed"
                            : "error") as "completed" | "error",
                        };
                      }
                      return event;
                    }
                  );
                  return { ...msg, toolCallEvents: updatedEvents };
                }
              }
              return msg;
            })
          );
        },
        // onComplete callback
        () => {
          console.log("🏁 [ChatInterface] Message completion started:", {
            assistantMessageId,
            finalContentLength:
              messages.find((m) => m.id === assistantMessageId)?.content
                .length || 0,
          });
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                // Parse citations from the final message content
                console.log(
                  "📄 [ChatInterface] Raw message content before parsing:",
                  msg.content
                );
                const { cleanedText, citations } = extractCitationsAndCleanText(
                  msg.content
                );
                console.log(
                  "🔗 [ChatInterface] Parsed citations from final message:",
                  citations
                );
                console.log("🧹 [ChatInterface] Cleaned text:", cleanedText);
                console.log(
                  "📊 [ChatInterface] Number of citations found:",
                  citations.length
                );

                // Create updated message with citations
                const updatedMessage = {
                  ...msg,
                  content: cleanedText,
                  citations: citations,
                  isStreaming: false,
                };

                // Collect all links from this message and its agent conversations
                const collectedLinks = collectLinksFromMessage(updatedMessage);
                console.log(
                  "🔗 [ChatInterface] Collected links:",
                  collectedLinks
                );

                const finalMessage = {
                  ...updatedMessage,
                  collectedLinks: collectedLinks,
                };

                console.log("✅ [ChatInterface] Message completion finished:", {
                  assistantMessageId,
                  finalContentLength: finalMessage.content.length,
                  citationsCount: finalMessage.citations?.length || 0,
                  collectedLinksCount: finalMessage.collectedLinks?.length || 0,
                  agentConversationsCount:
                    finalMessage.agentConversations?.length || 0,
                  toolCallEventsCount: finalMessage.toolCallEvents?.length || 0,
                });

                return finalMessage;
              }
              return msg;
            })
          );
          setIsLoading(false);

          // Create embedding for completed assistant message
          const completedMessage = messages.find(
            (m) => m.id === assistantMessageId
          );
          if (completedMessage) {
            createMessageEmbedding({ ...completedMessage, isStreaming: false });
          }
        },
        // onError callback
        (error: string) => {
          console.error("❌ [ChatInterface] Message error:", {
            assistantMessageId,
            error,
            errorType: typeof error,
          });
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: `Error: ${error}`,
                    isStreaming: false,
                  }
                : msg
            )
          );
          setIsLoading(false);

          // Create embedding for error message
          const errorMessage = {
            id: assistantMessageId,
            content: `Error: ${error}`,
            role: "assistant" as const,
            timestamp: new Date(),
            isStreaming: false,
          };
          createMessageEmbedding(errorMessage);
        },
        // onReasoningToken callback (NEW)
        (token: string) => {
          console.log("🧠 [ChatInterface] Received reasoning token");
          setReasoningContent((prev) => prev + token);
        }
      );
    } catch (error) {
      console.error("💥 [ChatInterface] Critical error in streaming chat:", {
        error: error instanceof Error ? error.message : error,
        errorType: typeof error,
        assistantMessageId,
        chatId,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Error: ${
                  error instanceof Error
                    ? error.message
                    : "Failed to send message"
                }`,
                isStreaming: false,
              }
            : msg
        )
      );
      setIsLoading(false);

      // Create embedding for error message
      const errorMessage = {
        id: assistantMessageId,
        content: `Error: ${
          error instanceof Error ? error.message : "Failed to send message"
        }`,
        role: "assistant" as const,
        timestamp: new Date(),
        isStreaming: false,
      };
      createMessageEmbedding(errorMessage);
    }
  };

  // Get current tool call events and agent conversations for the activity panel
  const currentToolCallEvents =
    messages.length > 0
      ? messages[messages.length - 1].toolCallEvents || []
      : [];
  const currentAgentConversations =
    messages.length > 0
      ? messages[messages.length - 1].agentConversations || []
      : [];

  console.log("📊 [ChatInterface] Render state:", {
    totalMessages: messages.length,
    isLoading,
    currentToolCallEventsCount: currentToolCallEvents.length,
    currentAgentConversationsCount: currentAgentConversations.length,
    isActivityPanelVisible,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "white",
      }}
    >
      {/* Agent conversations are now embedded within messages */}

      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput onSendMessage={handleSendMessage} disabled={isLoading} />

      {/* Activity Panel */}
      <ActivityPanel
        toolCallEvents={currentToolCallEvents}
        agentConversations={currentAgentConversations}
        isVisible={isActivityPanelVisible}
        onToggle={() => setIsActivityPanelVisible(!isActivityPanelVisible)}
      />
    </div>
  );
};

export default ChatInterface;
