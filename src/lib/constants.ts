import { LLMModel } from "./types";

export const MAX_ANONYMOUS_MESSAGES = 3;
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_DOCUMENT_SIZE_MB = 5;
export const ANONYMOUS_ID_COOKIE = "anonymous_id";
export const DEFAULT_MODEL: LLMModel = "qwen/qwen3.6-plus:free";

export const AVAILABLE_MODELS: {
  id: LLMModel;
  label: string;
  provider: "openrouter";
}[] = [
  { id: "qwen/qwen3.6-plus:free", label: "Qwen 3.6 Plus (Free)", provider: "openrouter" },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (Free)", provider: "openrouter" },
  { id: "google/gemini-2.5-flash:free", label: "Gemini 2.5 Flash (Free)", provider: "openrouter" },
];
