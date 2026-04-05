export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Chat {
  id: string;
  user_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  anonymous_id: string | null;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  images: string[];
  created_at: string;
}

export interface Document {
  id: string;
  chat_id: string;
  user_id: string | null;
  file_name: string;
  file_size: number;
  content: string;
  created_at: string;
}

export interface AnonymousUsage {
  id: string;
  anonymous_id: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export type LLMModel = 
  | "qwen/qwen3.6-plus:free"
  | "google/gemma-3-27b-it:free"
  | "google/gemini-2.5-flash:free";

export interface StreamChatRequest {
  chatId: string;
  message: string;
  images?: string[];
  documentIds?: string[];
  model?: LLMModel;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}
