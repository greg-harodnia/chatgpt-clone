"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Send, Image as ImageIcon, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LLMModel } from "@/lib/types";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/constants";
import Image from "next/image";

interface ChatInputProps {
  onSend: (message: string, images?: string[], documentIds?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  model?: LLMModel;
  onModelChange?: (model: LLMModel) => void;
  anonymousRemaining?: number | null;
  documentUploadSlot?: React.ReactNode;
  selectedDocumentIds?: string[];
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Type a message...",
  model = DEFAULT_MODEL,
  onModelChange,
  anonymousRemaining,
  documentUploadSlot,
  selectedDocumentIds,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (!message.trim() && images.length === 0) return;
    onSend(message.trim(), images.length > 0 ? images : undefined, selectedDocumentIds);
    setMessage("");
    setImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setImages((prev) => [...prev, event.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setImages((prev) => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="relative">
      {anonymousRemaining !== null && anonymousRemaining !== undefined && (
        <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          {anonymousRemaining > 0 ? (
            <span>{anonymousRemaining} free message{anonymousRemaining !== 1 ? "s" : ""} remaining</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Free limit reached. Log in for unlimited access.</span>
          )}
        </div>
      )}
      {documentUploadSlot}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {images.map((img, index) => (
            <div key={index} className="relative flex-shrink-0">
              <Image
                src={img}
                alt={`Attachment ${index + 1}`}
                width={80}
                height={80}
                className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handleImagePaste}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
          <div className="absolute right-2 bottom-2 flex gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            className="hidden sm:inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 h-11 text-xs"
          >
            {AVAILABLE_MODELS.find((m) => m.id === model)?.label ?? "Model"}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>OpenRouter</DropdownMenuLabel>
              {AVAILABLE_MODELS.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => onModelChange?.(m.id as LLMModel)}
                  className={cn(m.id === model && "bg-accent")}
                >
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          onClick={handleSubmit}
          disabled={disabled || (!message.trim() && images.length === 0)}
          size="icon"
          className="h-11 w-11 flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
