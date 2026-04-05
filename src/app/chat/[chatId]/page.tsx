"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { Message, LLMModel } from "@/lib/types";
import { subscribeToChat } from "@/lib/supabase/realtime";
import { DEFAULT_MODEL } from "@/lib/constants";

export default function ChatIdPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { getIdentifier } = useAuth();
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODEL);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then((p) => setChatId(p.chatId));
  }, [params]);

  const identifier = getIdentifier();

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

      // Add user message
      const userMessageRes = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: message,
          images: images || [],
        }),
      });
      if (!userMessageRes.ok) throw new Error("Failed to send message");

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
  });

  const handleSendMessage = async (
    message: string,
    images?: string[],
    documentIds?: string[]
  ) => {
    await sendMessageMutation.mutateAsync({ message, images, model: selectedModel });
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!chatId) return;

    const channel = subscribeToChat(chatId, (message) => {
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
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isStreaming}
          placeholder="Type a message..."
          model={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>
    </div>
  );
}
