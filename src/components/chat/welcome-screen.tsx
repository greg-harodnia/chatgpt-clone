"use client";

import { MessageSquare, Sparkles, Code, FileText, HelpCircle } from "lucide-react";

const suggestions = [
  {
    icon: Code,
    title: "Write code",
    description: "Help me write a function to sort an array",
  },
  {
    icon: FileText,
    title: "Summarize text",
    description: "Summarize the main points of an article",
  },
  {
    icon: Sparkles,
    title: "Creative writing",
    description: "Write a short story about a robot",
  },
  {
    icon: HelpCircle,
    title: "Answer questions",
    description: "Explain how machine learning works",
  },
];

export function WelcomeScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-4">
            <MessageSquare className="h-12 w-12 text-zinc-600 dark:text-zinc-400" />
          </div>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Welcome to ChatGPT Clone
        </h1>
        <p className="mb-8 text-zinc-600 dark:text-zinc-400">
          Start a conversation by typing a message below, or try one of these
          suggestions.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => {
                // This will be handled by the parent component
                const event = new CustomEvent("suggestion-click", {
                  detail: suggestion.description,
                });
                window.dispatchEvent(event);
              }}
            >
              <div className="rounded-lg bg-zinc-100 dark:bg-zinc-700 p-2">
                <suggestion.icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {suggestion.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {suggestion.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
