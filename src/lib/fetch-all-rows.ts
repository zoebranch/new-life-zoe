import type { PostgrestError } from "@supabase/supabase-js";

// A fresh query per page keeps filtering and ordering identical across requests.
export async function fetchAllRows<T>(query: (from: number, to: number) => PromiseLike<{data: T[] | null; error: PostgrestError | null}>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await query(from, from + 499);
    if (result.error) return {data: null, error: result.error};
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 500) return {data: rows, error: null};
  }
}
