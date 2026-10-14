// Persistance des QG : une ligne par utilisateur Telegram dans la table office_state (Supabase).

export function createSupabaseRepository(supabase) {
  return {
    async loadAll() {
      const { data, error } = await supabase.from("office_state").select("owner_id, state");
      if (error) throw new Error(error.message);
      return (data || []).map((row) => ({ ownerId: row.owner_id, state: row.state }));
    },

    async load(ownerId) {
      const { data, error } = await supabase.from("office_state").select("state").eq("owner_id", ownerId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.state ?? null;
    },

    async save(ownerId, state) {
      const { error } = await supabase
        .from("office_state")
        .upsert({ owner_id: ownerId, state, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
      if (error) throw new Error(error.message);
    },
  };
}

// Stockage en mémoire (tests, développement local sans base).
export function createMemoryRepository() {
  const rows = new Map();
  return {
    async loadAll() {
      return [...rows.entries()].map(([ownerId, state]) => ({ ownerId, state: structuredClone(state) }));
    },
    async load(ownerId) {
      return rows.has(ownerId) ? structuredClone(rows.get(ownerId)) : null;
    },
    async save(ownerId, state) {
      rows.set(ownerId, structuredClone(state));
    },
  };
}
