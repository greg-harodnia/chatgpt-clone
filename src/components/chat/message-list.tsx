"use client";

import { Message } from "@/lib/types";
import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isStreaming={isStreaming && message.id === "streaming"}
        />
      ))}
    </div>
  );
}

function MessageItem({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 rounded-full p-2",
          isUser
            ? "bg-blue-500 text-white"
            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "flex-1 rounded-2xl px-4 py-3 max-w-[80%]",
          isUser
            ? "bg-blue-500 text-white rounded-br-md"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md"
        )}
      >
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.images.map((img, index) => (
              <Image
                key={index}
                src={img}
                alt={`Attachment ${index + 1}`}
                width={200}
                height={200}
                className="max-w-[200px] max-h-[200px] object-cover rounded-lg"
              />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {isStreaming && (
          <span className="inline-block ml-1 animate-pulse">▊</span>
        )}
      </div>
    </div>
  );
}
