import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const anonymousId = url.searchParams.get("anonymousId");

    if (!userId && !anonymousId) {
      return NextResponse.json(
        { error: "userId or anonymousId is required" },
        { status: 400 },
      );
    }

    let query = supabase
      .from("chats")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (anonymousId) {
      query = query.eq("anonymous_id", anonymousId);
    }

    const { data, error } = await query;

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
    const body = await request.json();
    const { userId, anonymousId, title } = body;

    if (!userId && !anonymousId) {
      return NextResponse.json(
        { error: "userId or anonymousId is required" },
        { status: 400 },
      );
    }

    const chatData: Record<string, string | null> = {
      title: title || "New Chat",
    };

    if (userId) {
      chatData.user_id = userId;
    } else if (anonymousId) {
      chatData.anonymous_id = anonymousId;
    }

    const { data, error } = await supabase
      .from("chats")
      .insert(chatData)
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
