"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatInput } from "@/components/chat/chat-input";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { LLMModel } from "@/lib/types";
import { DEFAULT_MODEL } from "@/lib/constants";

export default function ChatPage() {
  const { getIdentifier } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODEL);

  const createChatMutation = useMutation({
    mutationFn: async (params: { message: string; images?: string[] }) => {
      const { message, images } = params;
      const identifier = getIdentifier();
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Chat",
          ...identifier,
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const chat = await res.json();
      
      // Send the first message
      const messageRes = await fetch(`/api/chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: message,
          images: images || [],
        }),
      });
      if (!messageRes.ok) throw new Error("Failed to send message");
      
      // Start streaming response
      const streamRes = await fetch(`/api/chats/${chat.id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          images,
          model: selectedModel,
          ...identifier,
        }),
      });
      if (!streamRes.ok) {
        const errBody = await streamRes.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to start stream");
      }
      
      return chat;
    },
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      window.location.href = `/chat/${chat.id}`;
    },
  });

  const handleSendMessage = async (message: string, images?: string[]) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createChatMutation.mutateAsync({ message, images });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <WelcomeScreen />
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isCreating}
          placeholder="Send a message to start a new chat..."
          model={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>
    </div>
  );
}
