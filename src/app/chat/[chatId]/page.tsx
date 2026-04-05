"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { Message, LLMModel } from "@/lib/types";
import { subscribeToChat } from "@/lib/supabase/realtime";
import { DEFAULT_MODEL } from "@/lib/constants";
import { AlertCircle, X } from "lucide-react";
import Link from "next/link";

async function checkAnonymousAccess(anonymousId: string | null): Promise<{ allowed: boolean; remaining: number }> {
  if (!anonymousId) return { allowed: true, remaining: Infinity };
  
  const res = await fetch(`/api/anonymous/check?anonymousId=${anonymousId}`);
  const data = await res.json();
  return { allowed: data.allowed, remaining: data.remaining };
}

async function consumeAnonymousMessage(anonymousId: string | null): Promise<boolean> {
  if (!anonymousId) return true;
  
  const res = await fetch("/api/anonymous/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymousId }),
  });
  return res.ok;
}

export default function ChatIdPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { getIdentifier, user } = useAuth();
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODEL);
  const [anonymousRemaining, setAnonymousRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setChatId(p.chatId));
  }, [params]);

  const identifier = getIdentifier();

  useEffect(() => {
    if (identifier.anonymousId) {
      checkAnonymousAccess(identifier.anonymousId).then((result) => {
        setAnonymousRemaining(result.remaining);
      });
    }
  }, [identifier.anonymousId]);

  const prevUserIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (prevUserIdRef.current !== null && user === null && chatId) {
      window.location.href = "/chat";
    }
    prevUserIdRef.current = user?.id ?? null;
  }, [user, chatId]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      if (!chatId) return [];
      const res = await fetch(`/api/chats/${chatId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<Message[]>;
    },
    enabled: !!chatId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      message,
      images,
      model,
    }: {
      message: string;
      images?: string[];
      model?: LLMModel;
    }) => {
      if (!chatId) throw new Error("No chat ID");

      if (identifier.anonymousId) {
        const { allowed, remaining } = await checkAnonymousAccess(identifier.anonymousId);
        if (!allowed) {
          setError("Free message limit reached. Please log in to continue.");
          return { blocked: true };
        }
        await consumeAnonymousMessage(identifier.anonymousId);
        setAnonymousRemaining(remaining - 1);
      }

      // Add user message
      const userMessageRes = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: message,
          images: images || [],
          ...identifier,
        }),
      });
      if (!userMessageRes.ok) {
        const errData = await userMessageRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to send message");
      }

      // Start streaming response
      setIsStreaming(true);
      const streamRes = await fetch(`/api/chats/${chatId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          images,
          model,
          ...identifier,
        }),
      });
      if (!streamRes.ok) {
        const errorText = await streamRes.text();
        let errorMessage = "Failed to start stream";
        try {
          const errorData = JSON.parse(errorText.replace(/^data: /, ""));
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Read the stream
      const reader = streamRes.body?.getReader();
      if (!reader) throw new Error("No reader");

      let assistantContent = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                // Update the UI with streaming content
                queryClient.setQueryData(
                  ["messages", chatId],
                  (old: Message[] = []) => {
                    const lastMessage = old[old.length - 1];
                    if (lastMessage?.role === "assistant") {
                      return [
                        ...old.slice(0, -1),
                        { ...lastMessage, content: assistantContent },
                      ];
                    }
                    return [
                      ...old,
                      {
                        id: "streaming",
                        chat_id: chatId,
                        role: "assistant",
                        content: assistantContent,
                        images: [],
                        created_at: new Date().toISOString(),
                      },
                    ];
                  }
                );
              }
            } catch {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      setIsStreaming(false);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
    onError: (err) => {
      if (err.message !== "No chat ID" && err.message !== "Failed to send message") {
        setError(err.message);
      }
    },
  });

  const handleSendMessage = async (
    message: string,
    images?: string[],
    _documentIds?: string[]
  ) => {
    setError(null);
    const result = await sendMessageMutation.mutateAsync({ message, images, model: selectedModel });
    if (result?.blocked) return;
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!chatId) return;

    const channel = subscribeToChat(chatId, (_message) => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [chatId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!chatId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
        <div ref={messagesEndRef} />
      </div>
      {error && (
        <div className="mx-4 mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Log in
            </Link>
            <button
              onClick={() => setError(null)}
              className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isStreaming}
          placeholder="Type a message..."
          model={selectedModel}
          onModelChange={setSelectedModel}
          anonymousRemaining={anonymousRemaining}
        />
      </div>
    </div>
  );
}
