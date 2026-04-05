"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, LogIn, LogOut } from "lucide-react";
import { Chat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { subscribeToChatList } from "@/lib/supabase/realtime";

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open }: SidebarProps) {
  const { user, logout, getIdentifier } = useAuth();
  const queryClient = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const identifier = getIdentifier();

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["chats", identifier],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (identifier.userId) params.set("userId", identifier.userId);
      if (identifier.anonymousId) params.set("anonymousId", identifier.anonymousId);
      
      const res = await fetch(`/api/chats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch chats");
      return res.json() as Promise<Chat[]>;
    },
    enabled: !!identifier.userId || !!identifier.anonymousId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!identifier.userId && !identifier.anonymousId) return;

    const channel = subscribeToChatList(
      identifier.userId || null,
      identifier.anonymousId || null,
      () => {
        queryClient.invalidateQueries({ queryKey: ["chats", identifier] });
      }
    );

    return () => {
      channel.unsubscribe();
    };
  }, [identifier.userId, identifier.anonymousId, queryClient, identifier]);

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Chat",
          ...identifier,
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      return res.json() as Promise<Chat>;
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["chats", identifier] });
      setActiveChatId(newChat.id);
      // Navigate to new chat
      window.location.href = `/chat/${newChat.id}`;
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete chat");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats", identifier] });
      if (activeChatId) {
        setActiveChatId(null);
        window.location.href = "/chat";
      }
    },
  });

  if (!open) {
    return (
      <div className="w-0 overflow-hidden transition-all duration-300">
        <div className="w-64 h-full flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
          <SidebarContent
            chats={chats}
            isLoading={isLoading}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            createChat={() => createChatMutation.mutate()}
            deleteChat={(id) => deleteChatMutation.mutate(id)}
            user={user}
            logout={logout}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300">
      <SidebarContent
        chats={chats}
        isLoading={isLoading}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        createChat={() => createChatMutation.mutate()}
        deleteChat={(id) => deleteChatMutation.mutate(id)}
        user={user}
        logout={logout}
      />
    </div>
  );
}

function SidebarContent({
  chats,
  isLoading,
  activeChatId,
  setActiveChatId,
  createChat,
  deleteChat,
  user,
  logout,
}: {
  chats: Chat[];
  isLoading: boolean;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  createChat: () => void;
  deleteChat: (id: string) => void;
  user: { id: string; email: string } | null;
  logout: () => Promise<void>;
}) {
  return (
    <>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <Button
          onClick={createChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse"
              />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chats yet</p>
            <p className="text-xs mt-1">Start a new conversation</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  activeChatId === chat.id
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                )}
                onClick={() => {
                  setActiveChatId(chat.id);
                  window.location.href = `/chat/${chat.id}`;
                }}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{chat.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-zinc-500">Logged in</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">Anonymous</p>
              <p className="text-xs text-zinc-500">3 free messages</p>
            </div>
            <a href="/login">
              <Button variant="ghost" size="icon">
                <LogIn className="h-4 w-4" />
              </Button>
            </a>
          </div>
        )}
      </div>
    </>
  );
}
