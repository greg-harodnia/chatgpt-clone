"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatInput } from "@/components/chat/chat-input";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { LLMModel } from "@/lib/types";
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

export default function ChatPage() {
  const { getIdentifier } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_MODEL);
  const [anonymousRemaining, setAnonymousRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identifier = getIdentifier();
    if (identifier.anonymousId) {
      checkAnonymousAccess(identifier.anonymousId).then((result) => {
        setAnonymousRemaining(result.remaining);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createChatMutation = useMutation({
    mutationFn: async (params: { message: string; images?: string[]; documentIds?: string[] }) => {
      const { message, images, documentIds } = params;
      const identifier = getIdentifier();

      if (identifier.anonymousId) {
        const { allowed, remaining } = await checkAnonymousAccess(identifier.anonymousId);
        if (!allowed) {
          setError("Free message limit reached. Please log in to continue.");
          return { blocked: true };
        }
        await consumeAnonymousMessage(identifier.anonymousId);
        setAnonymousRemaining(remaining - 1);
      }

      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Chat",
          ...identifier,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create chat");
      }
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
          documentIds,
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

  const handleSendMessage = async (message: string, images?: string[], documentIds?: string[]) => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const result = await createChatMutation.mutateAsync({ message, images, documentIds });
      if (result?.blocked) {
        setIsCreating(false);
        return;
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleSuggestionClick = (message: string) => {
    handleSendMessage(message);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
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
          disabled={isCreating}
          placeholder="Send a message to start a new chat..."
          model={selectedModel}
          onModelChange={setSelectedModel}
          anonymousRemaining={anonymousRemaining}
        />
      </div>
    </div>
  );
}
