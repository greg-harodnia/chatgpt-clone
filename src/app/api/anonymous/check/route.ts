import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_ANONYMOUS_MESSAGES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const url = new URL(request.url);
    const anonymousId = url.searchParams.get("anonymousId");

    if (!anonymousId) {
      return NextResponse.json(
        { error: "anonymousId is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("anonymous_usage")
      .select("*")
      .eq("anonymous_id", anonymousId)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const messageCount = data?.message_count || 0;
    const remaining = Math.max(0, MAX_ANONYMOUS_MESSAGES - messageCount);

    return NextResponse.json({
      anonymousId,
      messageCount,
      remaining,
      limit: MAX_ANONYMOUS_MESSAGES,
      allowed: remaining > 0,
    });
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
    const { anonymousId } = body;

    if (!anonymousId) {
      return NextResponse.json(
        { error: "anonymousId is required" },
        { status: 400 },
      );
    }

    // Check current usage
    const { data: existing } = await supabase
      .from("anonymous_usage")
      .select("*")
      .eq("anonymous_id", anonymousId)
      .single();

    if (existing) {
      if (existing.message_count >= MAX_ANONYMOUS_MESSAGES) {
        return NextResponse.json(
          {
            error: "Free message limit reached",
            messageCount: existing.message_count,
            remaining: 0,
            allowed: false,
          },
          { status: 403 },
        );
      }

      const { data, error } = await supabase
        .from("anonymous_usage")
        .update({ message_count: existing.message_count + 1 })
        .eq("anonymous_id", anonymousId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 },
        );
      }

      const remaining = Math.max(0, MAX_ANONYMOUS_MESSAGES - data.message_count);
      return NextResponse.json({
        messageCount: data.message_count,
        remaining,
        allowed: true,
      });
    }

    // Create new entry
    const { data, error } = await supabase
      .from("anonymous_usage")
      .insert({
        anonymous_id: anonymousId,
        message_count: 1,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const remaining = MAX_ANONYMOUS_MESSAGES - 1;
    return NextResponse.json({
      messageCount: data.message_count,
      remaining,
      allowed: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
