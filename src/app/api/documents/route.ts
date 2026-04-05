import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const url = new URL(request.url);
    const chatId = url.searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("documents")
      .select("id, file_name, file_size, created_at, chat_id")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await request.formData();

    const file = formData.get("file") as File;
    const chatId = formData.get("chatId") as string;
    const userId = formData.get("userId") as string | null;

    if (!file || !chatId) {
      return NextResponse.json(
        { error: "File and chatId are required" },
        { status: 400 },
      );
    }

    // Read file content as text
    const content = await file.text();

    const { data, error } = await supabase
      .from("documents")
      .insert({
        chat_id: chatId,
        user_id: userId || null,
        file_name: file.name,
        file_size: file.size,
        content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
