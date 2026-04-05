import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/constants";
import OpenAI from "openai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const supabase = createServiceClient();
  const { chatId } = await params;

  try {
    const body = await request.json();
    const { content, images, documentIds, model } = body as {
      content: string;
      images?: string[];
      documentIds?: string[];
      model?: string;
    };

    if (!content && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Content or images are required" },
        { status: 400 },
      );
    }

    // Fetch all messages for context (user message already saved via messages endpoint)
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    // Fetch document context if provided
    let documentContext = "";
    if (documentIds && documentIds.length > 0) {
      const { data: docs } = await supabase
        .from("documents")
        .select("file_name, content")
        .in("id", documentIds)
        .eq("chat_id", chatId);

      if (docs) {
        documentContext = docs
          .map((d) => `[${d.file_name}]\n${d.content}`)
          .join("\n\n---\n\n");
      }
    }

    // Build messages for the API
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a helpful AI assistant. Provide clear, concise, and accurate responses." +
          (documentContext
            ? `\n\nThe user has uploaded documents for context:\n\n${documentContext}`
            : ""),
      },
    ];

    // Build messages for the API
    // Skip the last user message since it's being sent fresh with images
    const historicalMessages = messages?.slice(0, -1) || [];
    
    for (const msg of historicalMessages) {
      if (msg.role === "user") {
        const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
          { type: "text", text: msg.content },
        ];

        if (msg.images && msg.images.length > 0) {
          for (const imgUrl of msg.images) {
            parts.push({
              type: "image_url",
              image_url: { url: imgUrl },
            });
          }
        }

        apiMessages.push({
          role: "user",
          content: parts,
        });
      } else {
        apiMessages.push({
          role: "assistant",
          content: msg.content,
        });
      }
    }

    // Add the current message with images from request body
    if (content) {
      const currentParts: OpenAI.Chat.ChatCompletionContentPart[] = [
        { type: "text", text: content },
      ];
      
      if (images && images.length > 0) {
        for (const imgUrl of images) {
          currentParts.push({
            type: "image_url",
            image_url: { url: imgUrl },
          });
        }
      }
      
      apiMessages.push({
        role: "user",
        content: currentParts,
      });
    }

    // Determine model
    const selectedModel = AVAILABLE_MODELS.find((m) => m.id === model);
    const modelName = selectedModel?.id ?? DEFAULT_MODEL;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY environment variable" },
        { status: 500 },
      );
    }

    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "ChatGPT Clone",
      },
    });

    const hasImages = images && images.length > 0;
    const modelsWithoutVision = ["deepseek/deepseek-chat-v3-0324"];
    
    if (hasImages && modelsWithoutVision.includes(modelName)) {
      const errorMsg = `Model ${modelName} does not support image inputs. Please select a vision-enabled model.`;
      return new Response(
        `data: ${JSON.stringify({ error: errorMsg })}\n\n`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    let stream;
    try {
      stream = await client.chat.completions.create({
        model: modelName,
        messages: apiMessages,
        stream: true,
        max_tokens: 4096,
      });
    } catch (apiError: unknown) {
      console.error("OpenRouter API Error:", apiError);
      let errorMessage = "API Error";
      if (apiError && typeof apiError === "object" && "error" in apiError) {
        const err = apiError as { error?: { error?: { message?: string } } | string };
        if (typeof err.error === "object" && err.error?.error?.message) {
          errorMessage = err.error.error.message;
        } else if (typeof err.error === "string") {
          errorMessage = err.error;
        }
      } else if (apiError instanceof Error) {
        errorMessage = apiError.message;
      }
      return NextResponse.json({ error: `OpenRouter Error: ${errorMessage}` }, { status: 400 });
    }

    const encoder = new TextEncoder();
    let fullContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              controller.enqueue(encoder.encode(content));
            }
          }

          // Save assistant message after stream completes
          await supabase.from("messages").insert({
            chat_id: chatId,
            content: fullContent,
            role: "assistant",
            images: [],
          });

          // Update chat title if it's the first exchange
          if (!messages || messages.length === 1) {
            const title =
              fullContent.length > 60
                ? fullContent.substring(0, 60).trim() + "..."
                : fullContent.trim();
            await supabase
              .from("chats")
              .update({ title, updated_at: new Date().toISOString() })
              .eq("id", chatId);
          } else {
            await supabase
              .from("chats")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", chatId);
          }

          controller.close();
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`\n[ERROR]: ${errorMsg}`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      `data: ${JSON.stringify({ error: message })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
}
