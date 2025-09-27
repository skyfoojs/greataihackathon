"use client";

import { Check, Copy, Loader2, Send } from "lucide-react";
import { CircleStop, Bot, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getCurrentUser } from "aws-amplify/auth";

const client = generateClient<Schema>();

interface Message {
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  sources?: string[];
}

interface AiResponse {
  answer: string;
  sources: {
    s3Uri?: string;
    preSignedUrl?: string;
    excerpt?: string;
  }[];
  blocked: boolean;
}

export default function ChatArea({
  sessionId,
  isNewSession,
}: {
  sessionId?: string;
  isNewSession?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviousChatLoading, setIsPreviousChatLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>("");
  const router = useRouter();
  const hasLoadedRef = useRef(false); // Track if we've already loaded for this session

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Get user ID once on mount
  useEffect(() => {
    async function getUserId() {
      try {
        const { userId } = await getCurrentUser();
        setUserId(userId);
      } catch (error) {
        console.error("Error getting user:", error);
      }
    }
    getUserId();
  }, []);

  // Reset messages when sessionId changes to a new one
  useEffect(() => {
    if (isNewSession) {
      router.replace(`/chat/${sessionId}`);
      setMessages([]);
      setInput("");
      hasLoadedRef.current = true; // Prevent loading for new sessions
    }
  }, [isNewSession, sessionId, router]);

  // Load chat history when sessionId or userId changes
  useEffect(() => {
    if (isNewSession) return; // Skip loading for new sessions
    if (!sessionId || !userId || hasLoadedRef.current) return;

    const loadChatHistory = async () => {
      setIsPreviousChatLoading(true);
      try {
        const prevMessages = await loadChatHistoryFromDB(sessionId, userId);
        setMessages(prevMessages);
      } catch (error) {
        console.error("Error loading chat history:", error);
        setMessages([]);
      } finally {
        setIsPreviousChatLoading(false);
        hasLoadedRef.current = true; // Mark as loaded for this session
      }
    };

    loadChatHistory();

    // Reset the loaded flag when sessionId changes
    return () => {
      hasLoadedRef.current = false;
    };
  }, [sessionId, userId, isNewSession]);

  const saveMessage = useCallback(
    async (
      sessionId: string,
      userId: string,
      role: "user" | "ai",
      message: string,
      sources?: string[]
    ) => {
      try {
        let sourcesStr = "";

        if (sources) {
          sourcesStr = sources.join(",");
        }

        await client.models.ChatMessage.create({
          sessionId,
          userId,
          role,
          message,
          sources: sourcesStr,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error saving message:", error);
      }
    },
    []
  );

  const loadChatHistoryFromDB = async (
    sessionId: string,
    userId: string
  ): Promise<Message[]> => {
    try {
      const { data: messages } = await client.models.ChatMessage.list({
        filter: {
          sessionId: { eq: sessionId },
          userId: { eq: userId },
        },
      });

      return messages
        .filter((msg) => msg.message !== null && msg.message !== undefined)
        .map((msg) => ({
          role: msg.role as "user" | "ai",
          content: msg.message as string,
          timestamp: new Date(msg.createdAt as string),
          sources: msg.sources ? (msg.sources as string).split(",") : [],
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error("Error loading chat history:", error);
      return [];
    }
  };

  async function sendMessage() {
    if (!input.trim() || isLoading || !sessionId || !userId) return;

    setIsLoading(true);

    // Add user message to UI immediately
    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    console.log("Current messages:", [...messages, userMessage]);
    setMessages((prev) => [...prev, userMessage]);

    const currentInput = input;
    setInput("");

    try {
      // Save user message to DB
      await saveMessage(sessionId, userId, "user", currentInput);

      // Call AI API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: currentInput,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: AiResponse = await res.json();

      const mappedSources = data.sources
        .map((source) => source.preSignedUrl)
        .filter((url): url is string => url !== undefined);

      // Add AI response to UI
      const aiMessage: Message = {
        role: "ai",
        content: data.answer,
        timestamp: new Date(),
        sources: mappedSources,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Save AI message to DB
      await saveMessage(sessionId, userId, "ai", data.answer, mappedSources);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      const errorMessage: Message = {
        role: "ai",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = async (text: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageIndex);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <>
      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Scrollable messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-blue-500" />
                Ask me anything about your documents
                <Sparkles className="w-8 h-8 text-blue-500" />
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                I&apos;m here to help you understand your medical records.
              </p>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-6 h-56">
              {isPreviousChatLoading && (
                <div className="flex flex-col items-center justify-center mt-20 space-y-4">
                  <Loader2 className="animate-spin" size={50} />
                  <p className="text-gray-500 dark:text-gray-400">
                    Loading chat history...
                  </p>
                </div>
              )}

              {!isPreviousChatLoading &&
                messages.length === 0 &&
                !isNewSession && (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Start a new conversation by sending a message below.
                  </div>
                )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} transition-all duration-300 ease-in-out`}
                >
                  <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                    {m.role === "user" ? (
                      "You"
                    ) : (
                      <>
                        <Bot size={14} className="text-blue-500" />
                        Medical AI Assistant
                      </>
                    )}
                  </span>
                  <div
                    className={`p-4 rounded-2xl max-w-lg transition-all duration-300 transform ${
                      m.role === "user"
                        ? "bg-blue-500 text-white shadow-lg hover:shadow-blue-500/25"
                        : "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl backdrop-blur-sm mb-2"
                    }`}
                  >
                    {m.role === "user" ? (
                      m.content
                    ) : (
                      <>
                        <div className="space-y-3 text-gray-800 dark:text-gray-200">
                          {m.content}
                          {m.sources && m.sources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Source Documents:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {m.sources.map(
                                  (source, index) =>
                                    source && (
                                      <a
                                        key={index}
                                        href={source}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs flex items-center transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        [{index + 1}]
                                      </a>
                                    )
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Copy button with feedback */}
                        {m.role === "ai" && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-2">
                            {copiedMessageId === i && (
                              <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-1 rounded-md animate-fade-in">
                                Copied!
                              </span>
                            )}
                            <button
                              onClick={() => copyToClipboard(m.content, i)}
                              className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                              title="Copy to clipboard"
                            >
                              {copiedMessageId === i ? (
                                <Check
                                  size={14}
                                  className="text-green-600 dark:text-green-400"
                                />
                              ) : (
                                <Copy
                                  size={14}
                                  className="text-gray-600 dark:text-gray-300"
                                />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator for AI response */}
              {isLoading && (
                <div className="flex flex-col items-start animate-fade-in">
                  <span className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Bot size={14} className="text-blue-500 animate-pulse" />
                    Medical AI Assistant is thinking...
                  </span>
                  <div className="p-4 rounded-2xl max-w-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg">
                    <div className="flex space-x-2">
                      <div
                        className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Analyzing medical records...
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Fixed input */}
        <footer className="border-t border-gray-200/10 dark:border-gray-700/50 p-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl">
            <div className="relative">
              <input
                className="w-full rounded-2xl bg-white dark:bg-gray-800 py-4 pl-6 pr-20 text-gray-800 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 transition-all duration-300 shadow-lg"
                placeholder="Ask about patient records, medications, or diagnoses..."
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" && !isLoading && sendMessage()
                }
                disabled={isLoading || !sessionId}
              />
              <button
                className={`absolute inset-y-0 right-0 flex items-center justify-center rounded-r-2xl m-1 ${
                  isLoading || !sessionId
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/50"
                } text-white h-[calc(100%-8px)] w-16`}
                onClick={sendMessage}
                disabled={isLoading || !sessionId}
              >
                {isLoading ? (
                  <CircleStop size={20} className="animate-pulse" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
              Ask about medications, diagnoses, treatment plans, or any medical
              information
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
