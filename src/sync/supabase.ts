import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RemoteStore } from "./engine";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the app is built without Supabase settings; it then runs local-only. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

const TABLE = "user_data";

/** The signed-in user's row in `user_data`, guarded by row-level security on the server. */
export function supabaseStore(client: SupabaseClient, userId: string): RemoteStore {
  return {
    async fetch() {
      const { data, error } = await client.from(TABLE).select("data, rev").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? { data: data.data, rev: Number(data.rev) } : null;
    },
    async insert(data) {
      const { error } = await client.from(TABLE).insert({ user_id: userId, data, rev: 1 });
      if (error?.code === "23505") return false; // row already exists
      if (error) throw error;
      return true;
    },
    async update(data, expectedRev) {
      const { data: rows, error } = await client
        .from(TABLE)
        .update({ data, rev: expectedRev + 1 })
        .eq("user_id", userId)
        .eq("rev", expectedRev)
        .select("rev");
      if (error) throw error;
      return (rows?.length ?? 0) > 0;
    },
  };
}
