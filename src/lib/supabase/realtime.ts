import { createClient, RealtimeChannel } from "@supabase/supabase-js";

export function createRealtimeClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function subscribeToChat(
  chatId: string,
  onMessage: (payload: { id: string; role: string; content: string; images: string[]; created_at: string }) => void,
): RealtimeChannel {
  const supabase = createRealtimeClient();

  const channel = supabase
    .channel(`chat:${chatId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        onMessage(payload.new as {
          id: string;
          role: string;
          content: string;
          images: string[];
          created_at: string;
        });
      },
    )
    .subscribe();

  return channel;
}

export function subscribeToChatList(
  userId: string | null,
  anonymousId: string | null,
  onChatChange: (payload: { id: string; title: string; updated_at: string }) => void,
): RealtimeChannel {
  const supabase = createRealtimeClient();

  const filter = userId
    ? `user_id=eq.${userId}`
    : anonymousId
      ? `anonymous_id=eq.${anonymousId}`
      : undefined;

  if (!filter) {
    throw new Error("Either userId or anonymousId must be provided");
  }

  const channel = supabase
    .channel(`chats:${filter}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chats",
        filter,
      },
      (payload) => {
        onChatChange(payload.new as {
          id: string;
          title: string;
          updated_at: string;
        });
      },
    )
    .subscribe();

  return channel;
}
